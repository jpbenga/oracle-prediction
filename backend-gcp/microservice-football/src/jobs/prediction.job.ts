const chalk = require('chalk');
const fs = require('fs');
const { LEAGUES_TO_ANALYZE } = require('../config/football.config');
const { apiFootballService } = require('../services/ApiFootball.service');
const { gestionJourneeService } = require('../services/GestionJournee.service');
const { analyseMatchService } = require('../services/AnalyseMatch.service');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface TeamStats {
    fixtures: { played: { total: number } };
    goals?: {
        for: { average: { total: string | number } },
        against: { average: { total: string | number } }
    };
    form: string;
}

function bayesianSmooth(avg: number, matchesPlayed: number, prior = 1.35, priorStrength = 5) {
    if (matchesPlayed > 0 && matchesPlayed < 6) {
        return (avg * matchesPlayed + prior * priorStrength) / (matchesPlayed + priorStrength);
    }
    return avg;
}

function parseOdds(oddsData: any[]) {
    if (!oddsData || oddsData.length === 0) return {};
    const parsed: { [key: string]: number } = {};
    const fixtureOdds = oddsData[0];
    for (const bookmaker of fixtureOdds.bookmakers) {
        for (const bet of bookmaker.bets) {
            switch (bet.id) {
                case 5: bet.values.forEach((v: any) => { const k = `match_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 8: bet.values.forEach((v: any) => { const k = v.value === 'Yes' ? 'btts' : 'btts_no'; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
            }
        }
    }
    return parsed;
}

async function runPrediction() {
    console.log(chalk.blue.bold("--- Démarrage du Job de Prédiction (Version Complète) ---"));
    const season = new Date().getFullYear();
    const predictions: { [leagueName: string]: any[] } = {};

    for (const league of LEAGUES_TO_ANALYZE) {
        console.log(chalk.cyan.bold(`\n[Analyse de la ligue] ${league.name}`));

        const upcomingMatches = await gestionJourneeService.getMatchesForPrediction(league.id, season);
        
        if (upcomingMatches && upcomingMatches.length > 0) {
            predictions[league.name] = [];
            for (const match of upcomingMatches) {
                console.log(chalk.green(`\n    Calcul pour : ${match.teams.home.name} vs ${match.teams.away.name}`));
                const homeTeamId = match.teams.home.id;
                const awayTeamId = match.teams.away.id;

                const [homeStats, awayStats, oddsData]: [TeamStats | null, TeamStats | null, any[] | null] = await Promise.all([
                    apiFootballService.getTeamStats(homeTeamId, league.id, season),
                    apiFootballService.getTeamStats(awayTeamId, league.id, season),
                    apiFootballService.getOddsForFixture(match.fixture.id)
                ]);

                if (!homeStats || !awayStats) {
                    console.log(chalk.red(`      -> Stats de base manquantes, match ignoré.`));
                    continue;
                }
                
                let homeAvgFor = parseFloat(homeStats.goals?.for.average.total as string) || 0;
                let homeAvgAgainst = parseFloat(homeStats.goals?.against.average.total as string) || 0;
                let awayAvgFor = parseFloat(awayStats.goals?.for.average.total as string) || 0;
                let awayAvgAgainst = parseFloat(awayStats.goals?.against.average.total as string) || 0;

                const matchesPlayed = homeStats.fixtures.played.total;
                const isEarlySeason = matchesPlayed < 6;

                if (isEarlySeason) {
                    console.log(chalk.yellow(`      -> Début de saison détecté (${matchesPlayed} matchs). Application des corrections.`));
                    const [prevHomeStats, prevAwayStats]: [TeamStats | null, TeamStats | null] = await Promise.all([
                        apiFootballService.getTeamStats(homeTeamId, league.id, season - 1),
                        apiFootballService.getTeamStats(awayTeamId, league.id, season - 1)
                    ]);

                    let stabilityBoost = 1;
                    if (prevHomeStats?.goals && prevAwayStats?.goals) {
                        const prevHomeAvgFor = parseFloat(prevHomeStats.goals.for.average.total as string) || homeAvgFor;
                        const prevAwayAvgFor = parseFloat(prevAwayStats.goals.for.average.total as string) || awayAvgFor;
                        const homeStability = Math.abs(prevHomeAvgFor - homeAvgFor) < 0.5 ? 1.1 : 1;
                        const awayStability = Math.abs(prevAwayAvgFor - awayAvgFor) < 0.5 ? 1.1 : 1;
                        stabilityBoost = (homeStability + awayStability) / 2;

                        homeAvgFor = (0.8 * prevHomeAvgFor) + (0.2 * homeAvgFor);
                        homeAvgAgainst = (0.8 * (parseFloat(prevHomeStats.goals.against.average.total as string) || homeAvgAgainst)) + (0.2 * homeAvgAgainst);
                        awayAvgFor = (0.8 * prevAwayAvgFor) + (0.2 * awayAvgFor);
                        awayAvgAgainst = (0.8 * (parseFloat(prevAwayStats.goals.against.average.total as string) || awayAvgAgainst)) + (0.2 * awayAvgAgainst);
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

                const predictionResult = analyseMatchService.predict(lambdas, homeStats, awayStats);
                let confidenceScores = predictionResult.markets;

                for (const market in confidenceScores) {
                    if (['draw', 'favorite_win', 'outsider_win'].includes(market)) {
                        confidenceScores[market] *= 1.2;
                    }
                }

                const maxConfidence = Math.max(...Object.values(confidenceScores) as number[]);
                if (maxConfidence < 60) {
                    console.log(chalk.yellow(`      -> Match exclu : aucune prédiction avec confiance ≥ 60%.`));
                    continue;
                }
                
                const parsedOdds = parseOdds(oddsData || []);
                const fixtureDate = new Date(match.fixture.date);

                // CORRECTION : On s'assure que le tableau existe avant d'y ajouter des éléments.
                const leaguePredictions = predictions[league.name];
                if (leaguePredictions) {
                    leaguePredictions.push({
                        matchLabel: `${match.teams.home.name} vs ${match.teams.away.name}`,
                        date: fixtureDate.toLocaleDateString('fr-FR'),
                        time: fixtureDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                        scores: confidenceScores,
                        odds: parsedOdds,
                        isEarlySeason
                    });
                }
                
                await sleep(500);
            }
        }
    }
    
    try {
        fs.writeFileSync('predictions_du_jour.json', JSON.stringify(predictions, null, 2));
        console.log(chalk.magenta.bold('\n-> Prédictions sauvegardées dans le fichier predictions_du_jour.json'));
    } catch (error) {
        console.error(chalk.red('Erreur lors de la sauvegarde du fichier JSON:'), error);
    }

    console.log(chalk.blue.bold("\n--- Job de Prédiction Terminé ---"));
}

module.exports = { runPrediction };