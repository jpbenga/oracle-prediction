// backend-gcp/microservice-football/src/jobs/ticket-generator.job.ts

import chalk from 'chalk';
import { firestoreService } from '../common/services/Firestore.service';
import { PredictionDocument } from '../common/types/football.types'; // Utilisation de notre type standard

const MAX_MATCHES_PER_TICKET = 3;
const MIN_TICKET_ODD = 1.8;
const MAX_TICKET_ODD = 2.3;

// On utilise notre type PredictionDocument pour plus de robustesse
type Bet = PredictionDocument & { expectedValue: number };

interface Ticket {
    bets: Bet[];
    totalOdd: number;
    totalExpectedValue: number;
    title: string;
}

// Les fonctions de logique métier restent les mêmes
function getConfidenceSliceKey(score: number): string {
    if (score >= 95) return "95-100";
    if (score >= 90) return "90-95";
    if (score >= 85) return "85-90";
    if (score >= 80) return "80-85";
    if (score >= 75) return "75-80";
    if (score >= 70) return "70-75";
    return "0-69"; 
}

function getCombinations(array: Bet[], size: number): Bet[][] {
    const result: Bet[][] = [];
    function combination(temp: Bet[], start: number) {
        if (temp.length === size) {
            result.push([...temp]);
            return;
        }
        for (let i = start; i < array.length; i++) {
            const current = array[i];
            if (current) {
                temp.push(current);
                combination(temp, i + 1);
                temp.pop();
            }
        }
    }
    combination([], 0);
    return result;
}

export async function runTicketGenerator(options: { date?: string } = {}) {
    console.log(chalk.blue.bold("--- Démarrage du Job de Génération de Tickets ---"));

    const targetDate = (options.date || new Date().toISOString().split('T')[0]);

    console.log(chalk.yellow(`Suppression des tickets PENDING existants pour le ${targetDate}...`));
    // CORRECTION : Utilisation de la méthode correcte
    await firestoreService.deletePendingTicketsForDate(targetDate);

    console.log(chalk.yellow(`Récupération des pronostics éligibles pour le ${targetDate}...`));
    // CORRECTION : Utilisation de la méthode correcte et du bon type
    const eligiblePredictions = (await firestoreService.getEligiblePredictionsForDate(targetDate)) as PredictionDocument[];

    if (eligiblePredictions.length === 0) {
        console.log(chalk.yellow('Aucune prédiction éligible trouvée. Aucun ticket ne sera généré.'));
        console.log(chalk.blue.bold("--- Job de Génération de Tickets Terminé ---"));
        return;
    }
    
    console.log(chalk.cyan(`${eligiblePredictions.length} pronostics éligibles trouvés.`));

    const eligibleBets: Bet[] = eligiblePredictions.map(pred => ({
        ...pred,
        expectedValue: pred.odd ? (pred.score / 100) * pred.odd : 0
    }));

    const allPossibleTickets: Ticket[] = [];

    for (let i = 1; i <= MAX_MATCHES_PER_TICKET; i++) {
        const combos = getCombinations(eligibleBets, i);
        for (const combo of combos) {
            const totalOdd = combo.reduce((acc, p) => acc * (p.odd || 1), 1);
            if (totalOdd >= MIN_TICKET_ODD && totalOdd <= MAX_TICKET_ODD) {
                const totalExpectedValue = combo.reduce((acc, p) => acc + (p.expectedValue || 0), 0);
                allPossibleTickets.push({
                    bets: combo,
                    totalOdd,
                    totalExpectedValue,
                    title: ''
                });
            }
        }
    }

    if (allPossibleTickets.length === 0) {
        console.log(chalk.yellow("Aucun ticket n'a pu être généré avec les critères actuels."));
        console.log(chalk.blue.bold("--- Job de Génération de Tickets Terminé ---"));
        return;
    }

    const bestTickets = allPossibleTickets.sort((a, b) => b.totalExpectedValue - a.totalExpectedValue).slice(0, 3);

    if (bestTickets.length > 0 && bestTickets[0]) {
        bestTickets[0].title = "The Oracle's Choice";
    }
    if (bestTickets.length > 1 && bestTickets[1]) {
        bestTickets[1].title = "The Agent's Play";
    }
    if (bestTickets.length > 2 && bestTickets[2]) {
        bestTickets[2].title = "The Red Pill";
    }
    
    try {
        console.log(chalk.magenta.bold(`\n-> Sauvegarde de ${bestTickets.length} tickets dans Firestore...`));
        for (const ticket of bestTickets) {
            if (ticket) {
                const ticketData = {
                    title: ticket.title,
                    total_odd: ticket.totalOdd,
                    total_expected_value: ticket.totalExpectedValue,
                    creation_date: targetDate,
                    status: 'PENDING',
                    // On ne stocke que les IDs, pas les objets entiers
                    bet_ids: ticket.bets.map(bet => bet.id) 
                };
                // CORRECTION : Utilisation du service pour sauvegarder
                await firestoreService.saveTicket(ticketData);
            }
        }
        console.log(chalk.green.bold(`-> ${bestTickets.length} tickets sauvegardés avec succès.`));
    } catch (error) {
        console.error(chalk.red('Erreur lors de la sauvegarde des tickets:'), error);
    }

    console.log(chalk.blue.bold("\n--- Job de Génération de Tickets Terminé ---"));
}