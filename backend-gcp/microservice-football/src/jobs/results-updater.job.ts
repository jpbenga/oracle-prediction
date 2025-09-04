// backend-gcp/microservice-football/src/jobs/results-updater.job.ts

import chalk from 'chalk';
import { firestoreService } from '../services/Firestore.service';
import { apiFootballService } from '../services/ApiFootball.service';
// CORRECTION : Import des types nécessaires
import { Match, PredictionDocument } from '../types/football.types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runResultsUpdater() {
    console.log(chalk.blue.bold("--- Démarrage du Job de Mise à Jour des Résultats ---"));

    const { predictions, tickets } = await firestoreService.getPendingItems();
    
    // CORRECTION : On caste la liste de prédictions avec notre nouveau type
    const pendingPredictions = predictions as PredictionDocument[];
    const pendingTickets = tickets; // Le type pour les tickets peut être ajouté de la même manière si besoin

    console.log(chalk.cyan("\nÉtape 1/2 : Vérification des pronostics en attente..."));
    if (pendingPredictions.length === 0) {
        console.log(chalk.yellow("Aucun pronostic en attente trouvé."));
    } else {
        console.log(chalk.cyan(`${pendingPredictions.length} pronostics en attente à traiter.`));
        for (const prediction of pendingPredictions) {
            console.log(chalk.cyan(`   -> Traitement du pronostic : ${prediction.matchLabel} (ID: ${prediction.id})`));
            
            const matchResult = await apiFootballService.getMatchById(prediction.fixtureId);

            if (matchResult && matchResult.fixture.status.short === 'FT') {
                // L'erreur est maintenant résolue car 'prediction' est du bon type
                const didWin = determinePredictionStatus(prediction, matchResult);
                if (didWin !== null) {
                    const newStatus = didWin ? 'WON' : 'LOST';
                    await firestoreService.updatePrediction(prediction.id, { status: newStatus });
                    console.log(chalk.green(`     -> Pronostic ${prediction.id} mis à jour au statut : ${newStatus}`));
                } else {
                    console.log(chalk.gray(`     -> Logique de marché non implémentée pour ${prediction.market}. Pronostic ignoré.`));
                }
            } else {
                console.log(chalk.yellow(`     -> Résultat non disponible ou match non terminé pour ${prediction.id}.`));
            }
            // Ajout d'une pause pour respecter les limites de l'API
            await sleep(500);
        }
    }

    // ... La logique pour les tickets reste la même
    console.log(chalk.cyan("\nÉtape 2/2 : Vérification des tickets en attente..."));
    if (pendingTickets.length === 0) {
        console.log(chalk.yellow("Aucun ticket en attente trouvé."));
    } else {
        console.log(chalk.cyan(`${pendingTickets.length} tickets en attente à traiter.`));
        for (const ticket of pendingTickets) {
            console.log(chalk.cyan(`   -> Traitement du ticket : ${ticket.id}`));
            if (!ticket.bet_refs || ticket.bet_refs.length === 0) continue;

            const allBetsStatus = await Promise.all(ticket.bet_refs.map(async (betRef: { get: () => any; }) => {
                const predictionDoc = await betRef.get();
                return predictionDoc.exists ? predictionDoc.data()?.status : 'PENDING';
            }));
            
            const isFinished = allBetsStatus.every((status: string) => status === 'WON' || status === 'LOST');
            
            if (isFinished) {
                let newTicketStatus: 'WON' | 'LOST' = 'LOST';
                if (allBetsStatus.every((status: string) => status === 'WON')) {
                    newTicketStatus = 'WON';
                }
                await firestoreService.updateTicketStatus(ticket.id, newTicketStatus);
                console.log(chalk.green(`     -> Ticket ${ticket.id} mis à jour au statut : ${newTicketStatus}`));
            } else {
                console.log(chalk.yellow(`     -> Le ticket ${ticket.id} contient encore des pronostics en attente.`));
            }
        }
    }

    console.log(chalk.blue.bold("\n--- Job de Mise à Jour des Résultats Terminé ---"));
}

// CORRECTION : La fonction accepte maintenant le type PredictionDocument
function determinePredictionStatus(prediction: PredictionDocument, matchResult: Match) {
    const homeGoals = matchResult.goals.home;
    const awayGoals = matchResult.goals.away;

    if (homeGoals === null || awayGoals === null) return null;

    switch (prediction.market) {
        case 'favorite_win':
            const homeOdd = prediction.odd;
            const awayOdd = 2;
            const isHomeFavorite = homeOdd ? homeOdd < awayOdd : false;
            return (isHomeFavorite && homeGoals > awayGoals) || (!isHomeFavorite && awayGoals > homeGoals);
        case 'outsider_win':
            const homeOddOutsider = 2;
            const awayOddOutsider = prediction.odd;
            const isAwayFavorite = awayOddOutsider ? awayOddOutsider < homeOddOutsider : false;
            return (isAwayFavorite && homeGoals > awayGoals) || (!isAwayFavorite && awayGoals > homeGoals);
        case 'draw':
            return homeGoals === awayGoals;
        case 'btts':
            return homeGoals > 0 && awayGoals > 0;
        case 'btts_no':
            return homeGoals === 0 || awayGoals === 0;
    }

    if (prediction.market.startsWith('match_over_')) {
        const threshold = parseFloat(prediction.market.replace('match_over_', ''));
        return (homeGoals + awayGoals) > threshold;
    }
    if (prediction.market.startsWith('match_under_')) {
        const threshold = parseFloat(prediction.market.replace('match_under_', ''));
        return (homeGoals + awayGoals) < threshold;
    }
    
    return null;
}