import chalk from 'chalk';
import admin from 'firebase-admin';
import { firestoreService } from '../services/Firestore.service';

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

const MAX_MATCHES_PER_TICKET = 3;
const MIN_TICKET_ODD = 1.8;
const MAX_TICKET_ODD = 2.3;

interface Bet {
    id: string;
    matchLabel: string;
    market: string;
    odd: number;
    matchDate: string;
    score: number;
    expectedValue: number;
    confidence_details: any;
    status?: string;
}

interface Ticket {
    bets: Bet[];
    totalOdd: number;
    totalExpectedValue: number;
    title: string;
}

function getConfidenceSliceKey(score: number): string {
    if (score >= 95) return "95-100";
    if (score >= 90) return "90-95";
    if (score >= 85) return "85-90";
    if (score >= 80) return "80-85";
    if (score >= 75) return "75-80";
    if (score >= 70) return "70-75";
    return "0-69"; 
}

function isPredictionEligible(prediction: Bet): boolean {
    if (!prediction.score || !prediction.market || !prediction.confidence_details) {
        return false;
    }

    const marketKey = Object.keys(prediction.confidence_details).find(key => key.startsWith(prediction.market));

    if (!marketKey) {
        return false;
    }

    const marketDetails = prediction.confidence_details[marketKey];
    if (!marketDetails) {
        return false;
    }

    const sliceKey = getConfidenceSliceKey(prediction.score);
    const sliceStats = marketDetails[sliceKey];

    if (!sliceStats || typeof sliceStats.success_rate === 'undefined') {
        return false;
    }

    return sliceStats.success_rate > 0.85;
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

    const targetDate = (options.date || new Date().toISOString().split('T')[0]) as string;

    console.log(chalk.yellow(`Suppression des tickets PENDING existants pour le ${targetDate}...`));
    await firestoreService.deleteTicketsForDate(targetDate);

    console.log(chalk.yellow(`Récupération des pronostics éligibles pour le ${targetDate} depuis Firestore...`));
    const eligiblePredictions: Bet[] = await firestoreService.getEligiblePredictions(targetDate);

    if (eligiblePredictions.length === 0) {
        console.log(chalk.yellow('Aucune prédiction éligible trouvée pour aujourd\'hui. Aucun ticket ne sera généré.'));
        console.log(chalk.blue.bold("--- Job de Génération de Tickets Terminé ---"));
        return;
    }
    
    console.log(chalk.cyan(`${eligiblePredictions.length} pronostics éligibles trouvés.`));

    const eligibleBets: Bet[] = eligiblePredictions.map(pred => ({
        ...pred,
        expectedValue: (pred.score / 100) * pred.odd
    }));

    const allPossibleTickets: Ticket[] = [];

    for (let i = 1; i <= MAX_MATCHES_PER_TICKET; i++) {
        const combos = getCombinations(eligibleBets, i);
        for (const combo of combos) {
            const totalOdd = combo.reduce((acc, p) => acc * p.odd, 1);
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

    if (bestTickets.length > 0) {
        const firstTicket = bestTickets[0];
        if (firstTicket) {
            firstTicket.title = "The Oracle's Choice";
        }
        if (bestTickets.length > 1) {
            const secondTicket = bestTickets[1];
            if (secondTicket) {
                secondTicket.title = "The Agent's Play";
            }
        }
        if (bestTickets.length > 2) {
            const thirdTicket = bestTickets[2];
            if (thirdTicket) {
                thirdTicket.title = "The Red Pill";
            }
        }
    }
    
    const ticketDuJour = bestTickets[0];

    try {
        console.log(chalk.magenta.bold('\n-> Sauvegarde des tickets générés dans Firestore...'));
        const batch = db.batch();
        let ticketCount = 0;

        for (const ticket of bestTickets) {
            if (ticket) {
                const ticketRef = db.collection('tickets').doc();
                const betRefs = ticket.bets.map(bet => db.collection('predictions').doc(bet.id));
    
                batch.set(ticketRef, {
                    title: ticket.title,
                    total_odd: ticket.totalOdd,
                    total_expected_value: ticket.totalExpectedValue,
                    creation_date: admin.firestore.Timestamp.fromDate(new Date(targetDate)),
                    status: 'PENDING',
                    bet_refs: betRefs
                });
                ticketCount++;
            }
        }

        await batch.commit();
        console.log(chalk.green.bold(`-> ${ticketCount} tickets sauvegardés avec succès dans Firestore.`));
        if(ticketDuJour) {
            console.log(chalk.green.bold(`-> Le Ticket du Jour est "${ticketDuJour.title}" avec une EV de ${ticketDuJour.totalExpectedValue.toFixed(2)}.`));
        }

    } catch (error) {
        if (error instanceof Error) {
            console.error(chalk.red('Erreur lors de la sauvegarde des tickets dans Firestore:'), error.message);
        } else {
            console.error(chalk.red('Erreur lors de la sauvegarde des tickets dans Firestore:'), error);
        }
    }

    console.log(chalk.blue.bold("\n--- Job de Génération de Tickets Terminé ---"));
}

module.exports = { runTicketGenerator };