const fs = require('fs');
const chalk = require('chalk');

const MIN_OCCURRENCE_RATE = 65;
const MIN_CONFIDENCE_SCORE_PRUDENT = 85;
const MIN_CONFIDENCE_SCORE_EQUILIBRE = 80;
const MIN_CONFIDENCE_SCORE_AUDACIEUX = 70;
const MIN_CONFIDENCE_EARLY_SEASON_BOOST = 5;
const MAX_TICKETS_PER_PROFILE = 20;
const MIN_ODD_PRUDENT = 1.5;
const MAX_ODD_PRUDENT = 3;
const TOLERANCE_ODD_PRUDENT = 0.1;
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

const MATCH_COUNT_WEIGHTS = {
    Prudent: { '1': 0.5, '2': 0.5 },
    Equilibre: { '3': 0.3, '4': 0.3, '5': 0.2, '6': 0.2 },
    Audacieux: { '8': 0.25, '9': 0.25, '10': 0.2, '11': 0.15, '12': 0.1, '13': 0.05, '14': 0.03, '15': 0.02 }
};

interface Bet {
    id: string;
    matchLabel: string;
    market: string;
    odd: number;
    date: string;
    profiles: string[];
    [key: string]: any;
}

function shuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function chooseMatchCount(profile: 'Prudent' | 'Equilibre' | 'Audacieux'): number {
    const weights = MATCH_COUNT_WEIGHTS[profile];
    const rand = Math.random();
    let cumulative = 0;
    for (const countStr in weights) {
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
    let probability = 1;
    bets.forEach(bet => {
        if (bet.odd) {
            probability *= (1 / bet.odd);
        }
    });
    return probability;
}

function generateCombinationTickets(bets: Bet[], targetOddMin: number, targetOddMax: number, profileName: 'Equilibre' | 'Audacieux', finalTicketsForDay: any, usageCounters: { [profile: string]: { [betId: string]: number } }, matchUsageCounters: any) {
    let availableBets = [...bets];
    let iterations = 0;
    const maxIterations = 200;
    const profileUsage = usageCounters[profileName];
    if (!finalTicketsForDay || !profileUsage) return;

    while (availableBets.length >= (profileName === 'Equilibre' ? MIN_MATCHES_EQUILIBRE : MIN_MATCHES_AUDACIEUX) && finalTicketsForDay[profileName].length < MAX_TICKETS_PER_PROFILE && iterations < maxIterations) {
        const matchCount = chooseMatchCount(profileName);
        let newTicket: Bet[] = [];
        let totalOdd = 1;
        let matchLabelsInTicket = new Set();
        let marketCounts: { [key: string]: number } = {};
        const dateKey = finalTicketsForDay[profileName][0]?.bets[0]?.date;
        let matchUsage = { ...(dateKey ? matchUsageCounters[dateKey] : {}) };
        availableBets = shuffle(availableBets);

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
        if (totalOdd >= targetOddMin && totalOdd <= targetOddMax && newTicket.length === matchCount && (profileName !== 'Audacieux' || ticketProbability >= MIN_TICKET_PROBABILITY) && isTicketUnique(newTicket, finalTicketsForDay[profileName])) {
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


function runTicketGenerator() {
    console.log(chalk.blue.bold("--- Démarrage du Job de Génération de Tickets ---"));

    let bilanData: any;
    let predictionsData: any;
    try {
        bilanData = JSON.parse(fs.readFileSync('bilan_backtest.json', 'utf8'));
        predictionsData = JSON.parse(fs.readFileSync('predictions_du_jour.json', 'utf8'));
    } catch (error) {
        console.error(chalk.red("Erreur : Fichiers de données non trouvés."));
        return;
    }

    const trustworthyMarkets = new Set<string>();
    const totalBacktestMatches = bilanData.totalMatchesAnalyzed;
    if (!totalBacktestMatches) {
        console.error(chalk.red("Erreur: 'totalMatchesAnalyzed' non trouvé."));
        return;
    }

    if (bilanData.detailedResults) {
        const marketOccurrences: { [key: string]: number } = {};
        bilanData.detailedResults.forEach((match: any) => {
            if (match.results) {
                for (const market in match.results) {
                    if (match.results[market] === true) {
                        marketOccurrences[market] = (marketOccurrences[market] || 0) + 1;
                    }
                }
            }
        });

        for (const market in marketOccurrences) {
            const count = marketOccurrences[market];
            if(count) {
                const rate = (count / totalBacktestMatches) * 100;
                if (rate > MIN_OCCURRENCE_RATE) {
                    trustworthyMarkets.add(market);
                }
            }
        }
    }

    let eligibleBets: Bet[] = [];
    for (const leagueName in predictionsData) {
        predictionsData[leagueName].forEach((match: any) => {
            if (!match.scores || !match.odds) return;
            const minScores = {
                Prudent: match.isEarlySeason ? MIN_CONFIDENCE_SCORE_PRUDENT + MIN_CONFIDENCE_EARLY_SEASON_BOOST : MIN_CONFIDENCE_SCORE_PRUDENT,
                Equilibre: match.isEarlySeason ? MIN_CONFIDENCE_SCORE_EQUILIBRE + MIN_CONFIDENCE_EARLY_SEASON_BOOST : MIN_CONFIDENCE_SCORE_EQUILIBRE,
                Audacieux: match.isEarlySeason ? MIN_CONFIDENCE_SCORE_AUDACIEUX + MIN_CONFIDENCE_EARLY_SEASON_BOOST : MIN_CONFIDENCE_SCORE_AUDACIEUX
            };
            for (const market in match.scores) {
                if (!trustworthyMarkets.has(market)) continue;
                const score = match.scores[market];
                const odd = match.odds[market];
                if (['draw', 'favorite_win', 'outsider_win'].includes(market) && score < 90) continue;
                if (odd) {
                    const profiles: string[] = [];
                    if (score >= minScores.Prudent && odd >= MIN_ODD_PRUDENT) profiles.push('Prudent');
                    if (score >= minScores.Equilibre) profiles.push('Equilibre');
                    if (score >= minScores.Audacieux) profiles.push('Audacieux');

                    if (profiles.length > 0) {
                        eligibleBets.push({ id: `${match.matchLabel}|${market}`, ...match, market, score, odd, profiles });
                    }
                }
            }
        });
    }

    const betsByDay = eligibleBets.reduce((acc, bet) => {
        (acc[bet.date] = acc[bet.date] || []).push(bet);
        return acc;
    }, {} as { [key: string]: Bet[] });

    const finalTickets: { [day: string]: any } = {};
    const usageCounters: { [profile: string]: { [betId: string]: number } } = { Prudent: {}, Equilibre: {}, Audacieux: {} };
    const matchUsageCounters: { [key: string]: any } = {};

    for (const day in betsByDay) {
        finalTickets[day] = { Prudent: [], Equilibre: [], Audacieux: [] };
        const dayBets = betsByDay[day];
        if (!dayBets) continue;

        const prudentBets = shuffle([...dayBets.filter(b => b.profiles.includes('Prudent'))]);
        const prudentUsage = usageCounters['Prudent'];
        if (!prudentUsage) continue;
        
        let prudentIterations = 0;
        while (prudentIterations < 500 && finalTickets[day].Prudent.length < MAX_TICKETS_PER_PROFILE) {
            const matchCount = chooseMatchCount('Prudent');
            const availableBets = shuffle([...prudentBets]);
            let newTicket: Bet[] = [];
            let totalOdd = 1;
            let matchLabelsInTicket = new Set();
            let marketCounts: { [key: string]: number } = {};
            let matchUsage = { ...matchUsageCounters[day] || {} };

            for (const bet of availableBets) {
                if (newTicket.length >= matchCount || totalOdd > (MAX_ODD_PRUDENT + TOLERANCE_ODD_PRUDENT)) break;
                const betCount = prudentUsage[bet.id] || 0;
                const matchCountUsage = matchUsage[bet.matchLabel] || 0;
                const marketType = bet.market.split('_')[0];
                if (!marketType) continue;
                marketCounts[marketType] = marketCounts[marketType] || 0;
                if (betCount < MAX_BET_USAGE && matchCountUsage < MAX_MATCH_USAGE && !matchLabelsInTicket.has(bet.matchLabel) && marketCounts[marketType] < 2) {
                    const newTotalOdd = totalOdd * bet.odd;
                    if (newTotalOdd <= (MAX_ODD_PRUDENT + TOLERANCE_ODD_PRUDENT) || newTicket.length < matchCount) {
                        newTicket.push(bet);
                        totalOdd = newTotalOdd;
                        matchLabelsInTicket.add(bet.matchLabel);
                        marketCounts[marketType]++;
                        matchUsage[bet.matchLabel] = (matchUsage[bet.matchLabel] || 0) + 1;
                    }
                }
            }

            if (totalOdd >= MIN_ODD_PRUDENT && totalOdd <= (MAX_ODD_PRUDENT + TOLERANCE_ODD_PRUDENT) && newTicket.length === matchCount && isTicketUnique(newTicket, finalTickets[day].Prudent)) {
                finalTickets[day].Prudent.push({ bets: newTicket, totalOdd });
                newTicket.forEach((b: Bet) => {
                    prudentUsage[b.id] = (prudentUsage[b.id] || 0) + 1;
                });
                matchUsageCounters[day] = matchUsage;
            }
            prudentIterations++;
        }

        generateCombinationTickets(
            dayBets.filter(b => b.profiles.includes('Equilibre')),
            TARGET_ODD_EQUILIBRE_MIN,
            TARGET_ODD_EQUILIBRE_MAX,
            'Equilibre',
            finalTickets[day],
            usageCounters,
            matchUsageCounters
        );
        generateCombinationTickets(
            dayBets.filter(b => b.profiles.includes('Audacieux')),
            TARGET_ODD_AUDACIEUX_MIN,
            TARGET_ODD_AUDACIEUX_MAX,
            'Audacieux',
            finalTickets[day],
            usageCounters,
            matchUsageCounters
        );
    }

    try {
        fs.writeFileSync('tickets_du_jour.json', JSON.stringify(finalTickets, null, 2));
        console.log(chalk.magenta.bold('\n-> Tickets du jour sauvegardés.'));
    } catch (error) {
        console.error(chalk.red('Erreur lors de la sauvegarde du fichier JSON:'), error);
    }

    console.log(chalk.blue.bold("\n--- Job de Génération de Tickets Terminé ---"));
}

module.exports = { runTicketGenerator };