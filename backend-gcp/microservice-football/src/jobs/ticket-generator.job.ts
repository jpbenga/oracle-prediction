process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
const chalk = require('chalk');
const admin = require('firebase-admin');
const { firestoreService } = require('../services/Firestore.service');

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

const MIN_SUCCESS_RATE_FOR_ELIGIBILITY = 85;
const MAX_TICKETS_PER_PROFILE = 20;
const MIN_ODD_PRUDENT = 1.5;
const MAX_ODD_PRUDENT = 3;
const TOLERANCE_ODD_PRUDENT = 0.1;
const MIN_ODD_EQUILIBRE = 1.2;
const MIN_ODD_AUDACIEUX = 1.35;
const TARGET_ODD_EQUILIBRE_MIN = 5;
const TARGET_ODD_EQUILIBRE_MAX = 12;
const TARGET_ODD_AUDACIEUX_MIN = 30;
const TARGET_ODD_AUDACIEUX_MAX = 500;
const MAX_MATCHES_PRUDENT = 2;
const MIN_MATCHES_EQUILIBRE = 3;
const MAX_MATCHES_EQUILIBRE = 6;
const MIN_MATCHES_AUDACIEUX = 8;
const MAX_MATCHES_AUDACIEUX = 15;
const MAX_BET_USAGE = 5;
const MAX_MATCH_USAGE = 3;
const MIN_TICKET_PROBABILITY = 0.001;

const PROFILE_KEYS = {
    PRUDENT: 'PROFILE_PRUDENT',
    EQUILIBRE: 'PROFILE_EQUILIBRE',
    AUDACIEUX: 'PROFILE_AUDACIEUX',
};

const MATCH_COUNT_WEIGHTS = {
    [PROFILE_KEYS.PRUDENT]: { '1': 0.5, '2': 0.5 },
    [PROFILE_KEYS.EQUILIBRE]: { '3': 0.3, '4': 0.3, '5': 0.2, '6': 0.2 },
    [PROFILE_KEYS.AUDACIEUX]: { '8': 0.25, '9': 0.25, '10': 0.2, '11': 0.15, '12': 0.1, '13': 0.05, '14': 0.03, '15': 0.02 }
};

interface Bet {
    id: string;
    matchLabel: string;
    market: string;
    odd: number;
    matchDate: string;
    profiles: string[];
    score: number;
    expectedValue: number;
    [key: string]: any;
}

function getConfidenceSlice(score: number): string {
    if (score >= 95) return "95-100";
    if (score >= 90) return "90-95";
    if (score >= 85) return "85-90";
    if (score >= 80) return "80-85";
    if (score >= 75) return "75-80";
    if (score >= 70) return "70-75";
    return "0-70";
}

function chooseMatchCount(profile: string, availableBetsCount: number): number {
    const weights = MATCH_COUNT_WEIGHTS[profile as keyof typeof MATCH_COUNT_WEIGHTS];
    if (!weights) return 2;
    const counts = Object.keys(weights).map(k => parseInt(k, 10));
    if (counts.length === 0) return 2;
    const index = availableBetsCount % counts.length;
    const selectedCount = counts[index];
    return selectedCount ?? counts[0] ?? 2;
}

function isTicketUnique(newTicket: Bet[], existingTickets: { bets: Bet[] }[]): boolean {
    const newMatchLabels = new Set(newTicket.map(bet => bet.matchLabel));
    for (const ticket of existingTickets) {
        const existingMatchLabels = new Set(ticket.bets.map(bet => bet.matchLabel));
        if (newMatchLabels.size === existingMatchLabels.size && [...newMatchLabels].every(label => existingMatchLabels.has(label))) {
            return false;
        }
    }
    return true;
}

function calculateTicketProbability(bets: Bet[]): number {
    return bets.reduce((prob, bet) => prob * (1 / bet.odd), 1);
}

function generateTicketsForProfile(
    profileName: string,
    availableBets: Bet[],
    targetOddMin: number,
    targetOddMax: number,
    maxIterations: number,
    finalTicketsForDay: { bets: Bet[]; totalOdd: number }[],
    usageCounters: { [key: string]: number },
    matchUsageCounters: { [key: string]: number }
) {
    let iterations = 0;
    while (finalTicketsForDay.length < MAX_TICKETS_PER_PROFILE && iterations < maxIterations) {
        iterations++;
        const matchCount = chooseMatchCount(profileName, availableBets.length);
        if (availableBets.length < matchCount) break;

        let newTicket: Bet[] = [];
        let totalOdd = 1;
        let matchLabelsInTicket = new Set<string>();
        let marketCounts: { [key: string]: number } = {};

        for (const bet of availableBets) {
            if (newTicket.length >= matchCount) break;
            const betCount = usageCounters[bet.id] || 0;
            const matchCountUsage = matchUsageCounters[bet.matchLabel] || 0;
            const marketType = bet.market.split('_')[0];
            if (!marketType) continue;

            marketCounts[marketType] = marketCounts[marketType] || 0;

            if (betCount < MAX_BET_USAGE && matchCountUsage < MAX_MATCH_USAGE && !matchLabelsInTicket.has(bet.matchLabel) && marketCounts[marketType] < 2) {
                const newTotalOdd = totalOdd * bet.odd;
                if (newTotalOdd <= targetOddMax) {
                    newTicket.push(bet);
                    totalOdd = newTotalOdd;
                    matchLabelsInTicket.add(bet.matchLabel);
                    marketCounts[marketType]++;
                }
            }
        }
        
        const ticketProbability = calculateTicketProbability(newTicket);
        const isAudacieuxProbValid = (profileName !== PROFILE_KEYS.AUDACIEUX || ticketProbability >= MIN_TICKET_PROBABILITY);

        if (totalOdd >= targetOddMin && newTicket.length === matchCount && isAudacieuxProbValid && isTicketUnique(newTicket, finalTicketsForDay)) {
            finalTicketsForDay.push({ bets: newTicket, totalOdd });
            newTicket.forEach(b => {
                usageCounters[b.id] = (usageCounters[b.id] || 0) + 1;
                matchUsageCounters[b.matchLabel] = (matchUsageCounters[b.matchLabel] || 0) + 1;
            });
        }
    }
}

async function runTicketGenerator(options?: { date?: string }) {
    console.log(chalk.blue.bold("--- Démarrage du Job de Génération de Tickets ---"));

    const targetDate = options?.date || new Date().toISOString().split('T')[0];

    console.log(chalk.yellow(`Suppression des tickets PENDING existants pour le ${targetDate}...`));
    await firestoreService.deleteTicketsForDate(targetDate);

    console.log(chalk.yellow(`Récupération des pronostics ELIGIBLE pour le ${targetDate} depuis Firestore...`));
    const eligiblePredictions: Bet[] = await firestoreService.getEligiblePredictions(targetDate);

    if (eligiblePredictions.length === 0) {
        console.log(chalk.green("Aucun pronostic ELIGIBLE trouvé pour cette date. Arrêt du job."));
        return;
    }
    console.log(chalk.cyan(`${eligiblePredictions.length} pronostics éligibles trouvés.`));

    const marketSuccessRates: { [key: string]: { [key: string]: number } } = {
        'goals_over_under': { '95-100': 98, '90-95': 92, '85-90': 88 },
        'match_winner': { '95-100': 96, '90-95': 91, '85-90': 86 }
    };

    const eligibleBets: Bet[] = eligiblePredictions.map(bet => {
        const profiles: string[] = [];
        const confidenceSlice = getConfidenceSlice(bet.score);
        const successRate = marketSuccessRates[bet.market]?.[confidenceSlice];

        if (successRate && successRate > MIN_SUCCESS_RATE_FOR_ELIGIBILITY) {
            if (bet.odd >= MIN_ODD_PRUDENT) profiles.push(PROFILE_KEYS.PRUDENT);
            if (bet.odd >= MIN_ODD_EQUILIBRE) profiles.push(PROFILE_KEYS.EQUILIBRE);
            if (bet.odd >= MIN_ODD_AUDACIEUX) profiles.push(PROFILE_KEYS.AUDACIEUX);
        }
        return { ...bet, profiles, expectedValue: (bet.score / 100) * bet.odd };
    }).filter(bet => bet.profiles.length > 0);

    eligibleBets.sort((a, b) => b.expectedValue - a.expectedValue || a.id.localeCompare(b.id));

    const betsByDay = eligibleBets.reduce((acc, bet) => {
        const day = bet.matchDate.split('T')[0];
        if (day) {
            (acc[day] = acc[day] || []).push(bet);
        }
        return acc;
    }, {} as { [key: string]: Bet[] });

    const finalTickets: { [key: string]: { [key: string]: { bets: Bet[], totalOdd: number }[] } } = {};
    const usageCounters: { [key: string]: { [key: string]: number } } = {
        [PROFILE_KEYS.PRUDENT]: {},
        [PROFILE_KEYS.EQUILIBRE]: {},
        [PROFILE_KEYS.AUDACIEUX]: {}
    };
    const matchUsageCounters: { [key: string]: { [key: string]: number } } = {};

    for (const day in betsByDay) {
        const dayBets = betsByDay[day];
        if (!dayBets) continue;

        finalTickets[day] = { [PROFILE_KEYS.PRUDENT]: [], [PROFILE_KEYS.EQUILIBRE]: [], [PROFILE_KEYS.AUDACIEUX]: [] };
        matchUsageCounters[day] = {};

        const currentDayTickets = finalTickets[day];
        const currentMatchCounters = matchUsageCounters[day];

        if (currentDayTickets && currentMatchCounters) {
            const prudentTickets = currentDayTickets[PROFILE_KEYS.PRUDENT];
            const prudentUsage = usageCounters[PROFILE_KEYS.PRUDENT];
            if (prudentTickets && prudentUsage) {
                generateTicketsForProfile(PROFILE_KEYS.PRUDENT, dayBets.filter(b => b.profiles.includes(PROFILE_KEYS.PRUDENT)), MIN_ODD_PRUDENT, MAX_ODD_PRUDENT + TOLERANCE_ODD_PRUDENT, 500, prudentTickets, prudentUsage, currentMatchCounters);
            }
            
            const equilibreTickets = currentDayTickets[PROFILE_KEYS.EQUILIBRE];
            const equilibreUsage = usageCounters[PROFILE_KEYS.EQUILIBRE];
            if (equilibreTickets && equilibreUsage) {
                generateTicketsForProfile(PROFILE_KEYS.EQUILIBRE, dayBets.filter(b => b.profiles.includes(PROFILE_KEYS.EQUILIBRE)), TARGET_ODD_EQUILIBRE_MIN, TARGET_ODD_EQUILIBRE_MAX, 200, equilibreTickets, equilibreUsage, currentMatchCounters);
            }
    
            const audacieuxTickets = currentDayTickets[PROFILE_KEYS.AUDACIEUX];
            const audacieuxUsage = usageCounters[PROFILE_KEYS.AUDACIEUX];
            if (audacieuxTickets && audacieuxUsage) {
                generateTicketsForProfile(PROFILE_KEYS.AUDACIEUX, dayBets.filter(b => b.profiles.includes(PROFILE_KEYS.AUDACIEUX)), TARGET_ODD_AUDACIEUX_MIN, TARGET_ODD_AUDACIEUX_MAX, 200, audacieuxTickets, audacieuxUsage, currentMatchCounters);
            }
        }
    }
    
    try {
        if (Object.values(finalTickets).every(p => Object.values(p).every(t => t.length === 0))) {
            console.log(chalk.yellow("Aucun ticket n'a pu être généré. Aucune sauvegarde nécessaire."));
            return;
        }

        console.log(chalk.magenta.bold('\n-> Sauvegarde des tickets générés dans Firestore...'));
        const batch = db.batch();
        let ticketCount = 0;

        for (const day in finalTickets) {
            const dayTickets = finalTickets[day];
            if (dayTickets) {
                for (const profileKey in dayTickets) {
                    const profileTickets = dayTickets[profileKey];
                    if (profileTickets) {
                        for (const ticket of profileTickets) {
                            const ticketRef = db.collection('tickets').doc();
                            const betRefs = ticket.bets.map(bet => db.collection('predictions').doc(bet.id));
        
                            batch.set(ticketRef, {
                                profile_key: profileKey,
                                total_odd: ticket.totalOdd,
                                creation_date: admin.firestore.Timestamp.fromDate(new Date(day)),
                                status: 'PENDING',
                                bet_refs: betRefs
                            });
                            ticketCount++;
                        }
                    }
                }
            }
        }

        await batch.commit();
        console.log(chalk.green.bold(`-> ${ticketCount} tickets sauvegardés avec succès dans Firestore.`));
    } catch (error) {
        console.error(chalk.red('Erreur lors de la sauvegarde des tickets dans Firestore:'), error);
    }

    console.log(chalk.blue.bold("\n--- Job de Génération de Tickets Terminé ---"));
}

module.exports = { runTicketGenerator };