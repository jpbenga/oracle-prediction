const chalk = require('chalk');
const { LEAGUES_TO_ANALYZE, LOW_OCCURRENCE_MARKETS } = require('../config/football.config');
const { apiFootballService } = require('../services/ApiFootball.service');
const { gestionJourneeService } = require('../services/GestionJournee.service');
const { analyseMatchService } = require('../services/AnalyseMatch.service');
const { firestoreService } = require('../services/Firestore.service');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

interface TeamStats {
    fixtures: { played: { total: number } };
    goals?: {
        for: { average: { total: string | number } },
        against: { average: { total: string | number } }
    };
    form: string;
}

function bayesianSmooth(avg, matchesPlayed, prior = 1.35, priorStrength = 5) {
    if (matchesPlayed > 0 && matchesPlayed < 6) {
        return (avg * matchesPlayed + prior * priorStrength) / (matchesPlayed + priorStrength);
    }
    return avg;
}

function parseOdds(oddsData) {
    if (!oddsData || oddsData.length === 0) return {};
    const parsed = {};
    const fixtureOdds = oddsData[0];
    for (const bookmaker of fixtureOdds.bookmakers) {
        const matchWinnerBet = bookmaker.bets.find((b) => b.id === 1);
        const doubleChanceBet = bookmaker.bets.find((b) => b.id === 12);
        if (matchWinnerBet) {
            const homeOdd = parseFloat(matchWinnerBet.values.find((v) => v.value === 'Home')?.odd);
            const drawOdd = parseFloat(matchWinnerBet.values.find((v) => v.value === 'Draw')?.odd);
            const awayOdd = parseFloat(matchWinnerBet.values.find((v) => v.value === 'Away')?.odd);
            if (homeOdd && drawOdd && awayOdd) {
                if (!parsed['draw']) parsed['draw'] = drawOdd;
                const isHomeFavorite = homeOdd < awayOdd;
                if (!parsed['favorite_win']) parsed['favorite_win'] = isHomeFavorite ? homeOdd : awayOdd;
                if (!parsed['outsider_win']) parsed['outsider_win'] = isHomeFavorite ? awayOdd : homeOdd;
                if (doubleChanceBet) {
                    const homeDrawOdd = parseFloat(doubleChanceBet.values.find((v) => v.value === 'Home/Draw')?.odd);
                    const awayDrawOdd = parseFloat(doubleChanceBet.values.find((v) => v.value === 'Draw/Away')?.odd);
                    if (homeDrawOdd && awayDrawOdd) {
                        if (!parsed['double_chance_favorite']) parsed['double_chance_favorite'] = isHomeFavorite ? homeDrawOdd : awayDrawOdd;
                        if (!parsed['double_chance_outsider']) parsed['double_chance_outsider'] = isHomeFavorite ? awayDrawOdd : homeDrawOdd;
                    }
                }
            }
        }
        for (const bet of bookmaker.bets) {
            switch (bet.id) {
                case 5: bet.values.forEach((v) => { const k = `match_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 8: bet.values.forEach((v) => { const k = v.value === 'Yes' ? 'btts' : 'btts_no'; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 16: bet.values.forEach((v) => { const k = `home_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 17: bet.values.forEach((v) => { const k = `away_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 6: bet.values.forEach((v) => { const k = `ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 26: bet.values.forEach((v) => { const k = `st_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 105: bet.values.forEach((v) => { const k = `home_ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 106: bet.values.forEach((v) => { const k = `away_ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
            }
        }
    }
    return parsed;
}

async function runPrediction(options) {
    console.info("--- Démarrage du Job de Prédiction ---");
    
    if (!firestoreService) {
        console.error('ERREUR: firestoreService est undefined!');
        return;
    }
    
    const season = new Date().getFullYear();

    let leaguesToProcess = LEAGUES_TO_ANALYZE;
    if (options?.leagueId) {
        const specificLeague = LEAGUES_TO_ANALYZE.find((l) => l.id === options.leagueId);
        if (specificLeague) {
            leaguesToProcess = [specificLeague];
        } else {
            console.error(`League with ID ${options.leagueId} not found in LEAGUES_TO_ANALYZE.`);
            return;
        }
    }

    for (const league of leaguesToProcess) {
        console.info(`\n[Analyse de la ligue] ${league.name}`);

        const matchday = options?.matchdayNumber || season;
        const upcomingMatches = await gestionJourneeService.getMatchesForPrediction(league.id, matchday);
        
        if (upcomingMatches && upcomingMatches.length > 0) {
            for (const match of upcomingMatches) {
                console.info(`\n    Calcul pour : ${match.teams.home.name} vs ${match.teams.away.name}`);
                const homeTeamId = match.teams.home.id;
                const awayTeamId = match.teams.away.id;

                const [homeStats, awayStats, oddsData] = await Promise.all([
                    apiFootballService.getTeamStats(homeTeamId, league.id, season),
                    apiFootballService.getTeamStats(awayTeamId, league.id, season),
                    apiFootballService.getOddsForFixture(match.fixture.id)
                ]);

                if (!homeStats || !awayStats) {
                    console.warn(`      -> Stats de base manquantes, match ignoré.`);
                    continue;
                }
                
                let homeAvgFor = parseFloat(homeStats.goals?.for.average.total) || 0;
                let homeAvgAgainst = parseFloat(homeStats.goals?.against.average.total) || 0;
                let awayAvgFor = parseFloat(awayStats.goals?.for.average.total) || 0;
                let awayAvgAgainst = parseFloat(awayStats.goals?.against.average.total) || 0;

                const matchesPlayed = homeStats.fixtures.played.total;
                
                if (matchesPlayed < 6) {
                    console.info(`      -> Début de saison détecté (${matchesPlayed} matchs). Application des corrections.`);
                    const [prevHomeStats, prevAwayStats] = await Promise.all([
                        apiFootballService.getTeamStats(homeTeamId, league.id, season - 1),
                        apiFootballService.getTeamStats(awayTeamId, league.id, season - 1)
                    ]);

                    let stabilityBoost = 1;
                    if (prevHomeStats?.goals && prevAwayStats?.goals) {
                        const prevHomeAvgFor = parseFloat(prevHomeStats.goals.for.average.total) || homeAvgFor;
                        const prevAwayAvgFor = parseFloat(prevAwayStats.goals.for.average.total) || awayAvgFor;
                        const homeStability = Math.abs(prevHomeAvgFor - homeAvgFor) < 0.5 ? 1.1 : 1;
                        const awayStability = Math.abs(prevAwayAvgFor - awayAvgFor) < 0.5 ? 1.1 : 1;
                        stabilityBoost = (homeStability + awayStability) / 2;

                        homeAvgFor = (0.8 * prevHomeAvgFor) + (0.2 * homeAvgFor);
                        homeAvgAgainst = (0.8 * (parseFloat(prevHomeStats.goals.against.average.total) || homeAvgAgainst)) + (0.2 * homeAvgAgainst);
                        awayAvgFor = (0.8 * prevAwayAvgFor) + (0.2 * awayAvgFor);
                        awayAvgAgainst = (0.8 * (parseFloat(prevAwayStats.goals.against.average.total) || awayAvgAgainst)) + (0.2 * awayAvgAgainst);
                    }
                    
                    homeAvgFor = bayesianSmooth(homeAvgFor, matchesPlayed) * stabilityBoost;
                    homeAvgAgainst = bayesianSmooth(homeAvgAgainst, matchesPlayed) * stabilityBoost;
                    awayAvgFor = bayesianSmooth(awayAvgFor, matchesPlayed) * stabilityBoost;
                    awayAvgAgainst = bayesianSmooth(awayAvgAgainst, matchesPlayed) * stabilityBoost;
                }

                const projectedHomeGoals = (homeAvgFor + awayAvgAgainst) / 2;
                const projectedAwayGoals = (awayAvgFor + homeAvgAgainst) / 2;
                
                const lambdaBoost = matchesPlayed >= 6 ? 1.1 : 1;
                const lambdas = {
                    home: projectedHomeGoals * lambdaBoost,
                    away: projectedAwayGoals * lambdaBoost,
                    ht: ((projectedHomeGoals + projectedAwayGoals) * 0.45) * lambdaBoost,
                    st: ((projectedHomeGoals + projectedAwayGoals) * 0.55) * lambdaBoost,
                    home_ht: (projectedHomeGoals * 0.45) * lambdaBoost,
                    home_st: (projectedHomeGoals * 0.55) * lambdaBoost,
                    away_ht: (projectedAwayGoals * 0.45) * lambdaBoost,
                    away_st: (projectedAwayGoals * 0.55) * lambdaBoost
                };

                const predictionResult = analyseMatchService.predict(lambdas, homeStats, awayStats, projectedHomeGoals, projectedAwayGoals);
                let confidenceScores = predictionResult.markets;

                for (const market in confidenceScores) {
                    if (LOW_OCCURRENCE_MARKETS.includes(market)) {
                        delete confidenceScores[market];
                    }
                }

                const maxConfidence = Math.max(...Object.values(confidenceScores));
                if (maxConfidence < 60) {
                    console.warn(`      -> Match exclu : aucune prédiction avec confiance \u2265 60%.`);
                    continue;
                }
                
                const parsedOdds = parseOdds(oddsData || []);
                
                let savedCount = 0;
                for (const market in confidenceScores) {
                    const score = confidenceScores[market];
                    if (score < 60) continue;

                    const odd = parsedOdds[market];
                    const status = odd ? 'ELIGIBLE' : 'INCOMPLETE';

                    const predictionData = {
                        fixtureId: match.fixture.id,
                        matchLabel: `${match.teams.home.name} vs ${match.teams.away.name}`,
                        matchDate: new Date(match.fixture.date).toISOString(),
                        leagueId: league.id,
                        market: market,
                        score: score,
                        odd: odd || null,
                        status: status,
                        createdAt: new Date().toISOString()
                    };

                    if (firestoreService && firestoreService.savePrediction) {
                        await firestoreService.savePrediction(predictionData);
                        savedCount++;
                    } else {
                        console.error('      [ERREUR] firestoreService.savePrediction non disponible!');
                    }
                }
                
                if (savedCount > 0) {
                    console.info(`      -> ${savedCount} prédictions sauvegardées dans Firestore.`);
                }

                await sleep(500);
            }
        }
    }
    
    console.info("\n--- Job de Prédiction Terminé ---");
    
    if (firestoreService && firestoreService.closeConnection) {
        await firestoreService.closeConnection();
    }
}

module.exports = { runPrediction };

runPrediction();