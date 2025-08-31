process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const chalk = require('chalk');
const { firestoreService } = require('../services/Firestore.service');
const { apiFootballService } = require('../services/ApiFootball.service');

async function runResultsUpdater() {
  console.log(chalk.blue.bold("--- Démarrage du Job de Mise à Jour des Résultats ---"));

  // 1. Process Predictions
  console.log(chalk.cyan("Vérification des pronostics en attente..."));
  const pendingPredictions = await firestoreService.getPendingPredictions();

  for (const prediction of pendingPredictions) {
    console.log(chalk.cyan(`  -> Traitement du pronostic : ${prediction.matchLabel} (ID: ${prediction.id})`));
    const matchResultData = await apiFootballService.getFixtureResult(prediction.fixtureId);
    
    // La réponse de l'API est un tableau, même pour un seul match
    const matchResult = matchResultData && matchResultData.length > 0 ? matchResultData[0] : null;

    if (matchResult && matchResult.fixture.status.short === 'FT') {
       // La logique de détermination du statut a été déplacée ici pour plus de clarté
       const didWin = determinePredictionStatus(prediction, matchResult);
       if (didWin !== null) {
         const newStatus = didWin ? 'WON' : 'LOST';
         await firestoreService.updatePrediction(prediction.id, { status: newStatus });
         console.log(chalk.green(`    -> Pronostic ${prediction.id} mis à jour au statut : ${newStatus}`));
       } else {
         console.log(chalk.gray(`    -> Logique de marché non implémentée pour ${prediction.market}. Pronostic ignoré.`));
       }
    } else {
      console.log(chalk.yellow(`    -> Résultat non disponible ou match non terminé pour ${prediction.id}.`));
    }
  }

  // 2. Process Tickets
  console.log(chalk.cyan("\nVérification des tickets en attente..."));
  const pendingTickets = await firestoreService.getPendingTickets();

  for (const ticket of pendingTickets) {
    console.log(chalk.cyan(`  -> Traitement du ticket : ${ticket.id}`));
    if (!ticket.bet_refs || ticket.bet_refs.length === 0) continue;

    const allBetsStatus = await Promise.all(ticket.bet_refs.map(async (betRef: { get: () => any; }) => {
      const predictionDoc = await betRef.get();
      return predictionDoc.exists ? predictionDoc.data()?.status : 'PENDING';
    }));
    
    const isFinished = allBetsStatus.every((status) => status === 'WON' || status === 'LOST');
    
    if (isFinished) {
        let newTicketStatus = 'LOST';
        if (allBetsStatus.every((status) => status === 'WON')) {
            newTicketStatus = 'WON';
        }
        await firestoreService.updateTicket(ticket.id, { status: newTicketStatus });
        console.log(chalk.green(`    -> Ticket ${ticket.id} mis à jour au statut : ${newTicketStatus}`));
    } else {
        console.log(chalk.yellow(`    -> Le ticket ${ticket.id} contient encore des pronostics en attente.`));
    }
  }

  console.log(chalk.blue.bold("\n--- Job de Mise à Jour des Résultats Terminé ---"));
}

function determinePredictionStatus(prediction: { market: string; odd: any; }, matchResult: { goals: { home: any; away: any; }; }) {
    const homeGoals = matchResult.goals.home;
    const awayGoals = matchResult.goals.away;

    if (homeGoals === null || awayGoals === null) return null;

    switch (prediction.market) {
        case 'favorite_win':
            const homeOdd = prediction.odd; // Supposons que la cote enregistrée est celle du favori
            const awayOdd = 2; // On ne peut pas savoir la cote de l'outsider, on compare juste les buts
            const isHomeFavorite = homeOdd < awayOdd; // Heuristique simple, pourrait être faux
            return (isHomeFavorite && homeGoals > awayGoals) || (!isHomeFavorite && awayGoals > homeGoals);
        case 'outsider_win':
            const homeOddOutsider = 2; // Similaire à ci-dessus
            const awayOddOutsider = prediction.odd;
            const isAwayFavorite = awayOddOutsider < homeOddOutsider;
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
    
    return null; // Marché non géré
}

runResultsUpdater();

module.exports = { runResultsUpdater };