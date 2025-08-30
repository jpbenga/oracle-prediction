const fs = require('fs');
const chalk = require('chalk');

// --- Tâche 3: Intégration Firestore ---
const admin = require('firebase-admin');

// Initialisation du SDK Admin. Sur GCP, l'authentification est automatique.
admin.initializeApp();
const db = admin.firestore();

// Constantes de configuration
const MIN_SUCCESS_RATE_FOR_ELIGIBILITY = 85; // Tâche 1
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

// --- Préparation i18n ---
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
    id: string; // ID du document Firestore
    matchLabel: string;
    market: string; // market_key dans la DB
    odd: number;
    date: string;
    profiles: string[];
    score: number;
    expectedValue: number;
    [key: string]: any;
}

// --- Tâche 1: Helper pour la tranche de confiance ---
function getConfidenceSlice(score: number): string {
    if (score >= 95) return "95-100";
    if (score >= 90) return "90-95";
    if (score >= 85) return "85-90";
    if (score >= 80) return "80-85";
    if (score >= 75) return "75-80";
    if (score >= 70) return "70-75";
    return "0-70";
}

// --- Fonctions utilitaires (sans shuffle) ---
function chooseMatchCount(profile: string): number {
    const weights = MATCH_COUNT_WEIGHTS[profile as keyof typeof MATCH_COUNT_WEIGHTS];
    if (!weights) return 2;
    
    const rand = Math.random();
    let cumulative = 0;
    for (const countStr of Object.keys(weights)) {
        const count = parseInt(countStr, 10);
        const weight = weights[countStr as keyof typeof weights];
        if (weight) {
            cumulative += weight;
            if (rand <= cumulative) return count;
        }
    }
    const fallbackKey = Object.keys(weights)[0];
    return fallbackKey ? parseInt(fallbackKey, 10) : 2;
}

function isTicketUnique(newTicket: Bet[], existingTickets: any[]): boolean {
    const newMatchLabels = new Set(newTicket.map(bet => bet.matchLabel));
    for (const ticket of existingTickets) {
        const existingMatchLabels = new Set(ticket.bets.map((bet: Bet) => bet.matchLabel));
        if (newMatchLabels.size === existingMatchLabels.size && [...newMatchLabels].every(label => existingMatchLabels.has(label))) {
            return false;
        }
    }
    return true;
}

function calculateTicketProbability(bets: Bet[]): number {
    return bets.reduce((prob, bet) => prob * (1 / bet.odd), 1);
}

function generateCombinationTickets(bets: Bet[], targetOddMin: number, targetOddMax: number, profileName: string, finalTicketsForDay: any, usageCounters: { [profile: string]: { [betId: string]: number } }, matchUsageCounters: any) {
    const availableBets = [...bets]; // La liste est déjà triée
    let iterations = 0;
    const maxIterations = 200;
    const profileUsage = usageCounters[profileName];
    if (!finalTicketsForDay || !profileUsage) return;

    const minMatches = profileName === PROFILE_KEYS.EQUILIBRE ? MIN_MATCHES_EQUILIBRE : MIN_MATCHES_AUDACIEUX;

    while (availableBets.length >= minMatches && finalTicketsForDay[profileName].length < MAX_TICKETS_PER_PROFILE && iterations < maxIterations) {
        const matchCount = chooseMatchCount(profileName);
        let newTicket: Bet[] = [];
        let totalOdd = 1;
        let matchLabelsInTicket = new Set();
        let marketCounts: { [key: string]: number } = {};
        const dateKey = finalTicketsForDay[profileName][0]?.bets[0]?.date;
        let matchUsage = { ...(dateKey ? matchUsageCounters[dateKey] : {}) };

        // Pas de shuffle ici, on parcourt la liste déjà triée
        for (const bet of availableBets) {
            if (newTicket.length >= matchCount || totalOdd > targetOddMax) break;
            const betCount = profileUsage[bet.id] || 0;
            const matchCountUsage = matchUsage[bet.matchLabel] || 0;
            const marketType = bet.market.split('_')[0];
            if (!marketType) continue;
            marketCounts[marketType] = marketCounts[marketType] || 0;
            if (betCount < MAX_BET_USAGE && matchCountUsage < MAX_MATCH_USAGE && !matchLabelsInTicket.has(bet.matchLabel) && marketCounts[marketType] < 2) {
                const newTotalOdd = totalOdd * bet.odd;
                if (newTotalOdd <= targetOddMax || newTicket.length < matchCount) {
                    newTicket.push(bet);
                    totalOdd = newTotalOdd;
                    matchLabelsInTicket.add(bet.matchLabel);
                    marketCounts[marketType]++;
                    matchUsage[bet.matchLabel] = (matchUsage[bet.matchLabel] || 0) + 1;
                }
            }
        }

        const ticketProbability = calculateTicketProbability(newTicket);
        if (totalOdd >= targetOddMin && totalOdd <= targetOddMax && newTicket.length === matchCount && (profileName !== PROFILE_KEYS.AUDACIEUX || ticketProbability >= MIN_TICKET_PROBABILITY) && isTicketUnique(newTicket, finalTicketsForDay[profileName])) {
            finalTicketsForDay[profileName].push({ bets: newTicket, totalOdd });
            newTicket.forEach((b: Bet) => {
                profileUsage[b.id] = (profileUsage[b.id] || 0) + 1;
            });
            const firstBetDate = newTicket[0]?.date;
            if (firstBetDate) {
                 matchUsageCounters[firstBetDate] = matchUsage;
            }
        }
        iterations++;
    }
}

async function runTicketGenerator() {
    console.log(chalk.blue.bold("--- Démarrage du Job de Génération de Tickets (Version Firestore) ---"));

    let bilanData: any;
    let allPendingBets: Bet[];

    try {
        bilanData = JSON.parse(fs.readFileSync('bilan_backtest.json', 'utf8'));
        console.log(chalk.yellow("Récupération des pronostics depuis Firestore..."));
        const snapshot = await db.collection('bets').where('status', '==', 'PENDING').get();

        if (snapshot.empty) {
            console.log(chalk.green("Aucun pronostic en attente trouvé. Arrêt du job."));
            return;
        }

        allPendingBets = [];
        snapshot.forEach((doc: { data: () => any; id: any; }) => {
            const data = doc.data();
            const dateStr = data.match_date.toDate().toISOString().split('T')[0];
            allPendingBets.push({ id: doc.id, market: data.market_key, ...data, date: dateStr } as Bet);
        });
        console.log(chalk.green(`${allPendingBets.length} pronostics récupérés.`));

    } catch (error) {
        console.error(chalk.red("Erreur critique lors de l'initialisation des données:"), error);
        return;
    }

    const marketSuccessRates = bilanData.marketSuccessRates;
    if (!marketSuccessRates) {
        console.error(chalk.red("Erreur: 'marketSuccessRates' non trouvé."));
        return;
    }

    const eligibleBets: Bet[] = allPendingBets.map(bet => {
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
        (acc[bet.date] = acc[bet.date] || []).push(bet);
        return acc;
    }, {} as { [key: string]: Bet[] });

    const finalTickets: { [day: string]: any } = {};
    const usageCounters: { [profile: string]: { [betId: string]: number } } = { [PROFILE_KEYS.PRUDENT]: {}, [PROFILE_KEYS.EQUILIBRE]: {}, [PROFILE_KEYS.AUDACIEUX]: {} };
    const matchUsageCounters: { [key: string]: any } = {};

    // *** CORRECTION: Logique de génération de tickets réintégrée ***
    for (const day in betsByDay) {
        finalTickets[day] = { [PROFILE_KEYS.PRUDENT]: [], [PROFILE_KEYS.EQUILIBRE]: [], [PROFILE_KEYS.AUDACIEUX]: [] };
        const dayBets = betsByDay[day];
        if (!dayBets) continue;

        // --- Génération des tickets PRUDENT ---
        const prudentBets = dayBets.filter(b => b.profiles.includes(PROFILE_KEYS.PRUDENT));
        const prudentUsage = usageCounters[PROFILE_KEYS.PRUDENT];
        if (prudentUsage) {
            let prudentIterations = 0;
            while (prudentIterations < 500 && finalTickets[day][PROFILE_KEYS.PRUDENT].length < MAX_TICKETS_PER_PROFILE) {
                const matchCount = chooseMatchCount(PROFILE_KEYS.PRUDENT);
                const availableBets = [...prudentBets]; // La liste est déjà triée
                let newTicket: Bet[] = [];
                let totalOdd = 1;
                let matchLabelsInTicket = new Set();
                let marketCounts: { [key: string]: number } = {};
                let matchUsage = { ...matchUsageCounters[day] || {} };

                for (const bet of availableBets) {
                    if (newTicket.length >= matchCount) break;
                    const betCount = prudentUsage[bet.id] || 0;
                    const matchCountUsage = matchUsage[bet.matchLabel] || 0;
                    const marketType = bet.market.split('_')[0];
                    if (!marketType) continue;
                    marketCounts[marketType] = marketCounts[marketType] || 0;
                    if (betCount < MAX_BET_USAGE && matchCountUsage < MAX_MATCH_USAGE && !matchLabelsInTicket.has(bet.matchLabel) && marketCounts[marketType] < 2) {
                        const newTotalOdd = totalOdd * bet.odd;
                        if (newTotalOdd <= (MAX_ODD_PRUDENT + TOLERANCE_ODD_PRUDENT)) {
                            newTicket.push(bet);
                            totalOdd = newTotalOdd;
                            matchLabelsInTicket.add(bet.matchLabel);
                            marketCounts[marketType]++;
                            matchUsage[bet.matchLabel] = (matchUsage[bet.matchLabel] || 0) + 1;
                        }
                    }
                }

                if (totalOdd >= MIN_ODD_PRUDENT && totalOdd <= (MAX_ODD_PRUDENT + TOLERANCE_ODD_PRUDENT) && newTicket.length === matchCount && isTicketUnique(newTicket, finalTickets[day][PROFILE_KEYS.PRUDENT])) {
                    finalTickets[day][PROFILE_KEYS.PRUDENT].push({ bets: newTicket, totalOdd });
                    newTicket.forEach((b: Bet) => { prudentUsage[b.id] = (prudentUsage[b.id] || 0) + 1; });
                    matchUsageCounters[day] = matchUsage;
                }
                prudentIterations++;
            }
        }

        // --- Génération des tickets EQUILIBRE & AUDACIEUX ---
        generateCombinationTickets(dayBets.filter(b => b.profiles.includes(PROFILE_KEYS.EQUILIBRE)), TARGET_ODD_EQUILIBRE_MIN, TARGET_ODD_EQUILIBRE_MAX, PROFILE_KEYS.EQUILIBRE, finalTickets[day], usageCounters, matchUsageCounters);
        generateCombinationTickets(dayBets.filter(b => b.profiles.includes(PROFILE_KEYS.AUDACIEUX)), TARGET_ODD_AUDACIEUX_MIN, TARGET_ODD_AUDACIEUX_MAX, PROFILE_KEYS.AUDACIEUX, finalTickets[day], usageCounters, matchUsageCounters);
    }

    try {
        if (Object.values(finalTickets).every((p: any) => Object.values(p).every((t: any) => t.length === 0))) {
            console.log(chalk.yellow("Aucun ticket n'a pu être généré. Aucune sauvegarde nécessaire."));
            return;
        }

        console.log(chalk.magenta.bold('\n-> Sauvegarde des tickets générés dans Firestore...'));
        const batch = db.batch();
        let ticketCount = 0;

        for (const day in finalTickets) {
            for (const profileKey in finalTickets[day]) {
                for (const ticket of finalTickets[day][profileKey]) {
                    const ticketRef = db.collection('tickets').doc();
                    const betRefs = ticket.bets.map((bet: Bet) => db.collection('bets').doc(bet.id));

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

        await batch.commit();
        console.log(chalk.green.bold(`-> ${ticketCount} tickets sauvegardés avec succès dans Firestore.`));

    } catch (error) {
        console.error(chalk.red('Erreur lors de la sauvegarde des tickets dans Firestore:'), error);
    }

    console.log(chalk.blue.bold("\n--- Job de Génération de Tickets Terminé ---"));
}

module.exports = { runTicketGenerator };