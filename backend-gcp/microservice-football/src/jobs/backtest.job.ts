const chalk = require('chalk');
const fs = require('fs');
const { LEAGUES_TO_ANALYZE } = require('../config/football.config');
const { apiFootballService } = require('../services/ApiFootball.service');
const { gestionJourneeService } = require('../services/GestionJournee.service');
const { analyseMatchService } = require('../services/AnalyseMatch.service');
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

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

function analyzeMatchMarkets(fixture: any, projectedHomeGoals: number, projectedAwayGoals: number) {
    const results: { [key: string]: boolean } = {};
    const ff = fixture.goals;
    const fh = fixture.score.halftime;
    if (ff.home === null || ff.away === null || fh.home === null || fh.away === null) return null;

    const didHomeWin = ff.home > ff.away;
    const didAwayWin = ff.away > ff.home;
    const wasDraw = ff.home === ff.away;
    const isHomeFavoriteModel = projectedHomeGoals > projectedAwayGoals;

    results['draw'] = wasDraw;
    results['favorite_win'] = (isHomeFavoriteModel && didHomeWin) || (!isHomeFavoriteModel && didAwayWin);
    results['outsider_win'] = (isHomeFavoriteModel && didAwayWin) || (!isHomeFavoriteModel && didHomeWin);
    results['double_chance_favorite'] = results['favorite_win'] || wasDraw;
    results['double_chance_outsider'] = results['outsider_win'] || wasDraw;

    const sh = { home: ff.home - fh.home, away: ff.away - fh.away };
    results['btts'] = ff.home > 0 && ff.away > 0;
    results['btts_no'] = !results['btts'];

    [0.5, 1.5, 2.5, 3.5].forEach(t => {
        results[`match_over_${t}`] = ff.home + ff.away > t;
        results[`match_under_${t}`] = ff.home + ff.away < t;
        results[`ht_over_${t}`] = fh.home + fh.away > t;
        results[`ht_under_${t}`] = fh.home + fh.away < t;
        results[`st_over_${t}`] = sh.home + sh.away > t;
        results[`st_under_${t}`] = sh.home + sh.away < t;
        results[`home_over_${t}`] = ff.home > t;
        results[`home_under_${t}`] = ff.home < t;
        results[`away_over_${t}`] = ff.away > t;
        results[`away_under_${t}`] = ff.away < t;
        results[`home_ht_over_${t}`] = fh.home > t;
        results[`home_ht_under_${t}`] = fh.home < t;
        results[`away_ht_over_${t}`] = fh.away > t;
        results[`away_ht_under_${t}`] = fh.away < t;
        results[`home_st_over_${t}`] = sh.home > t;
        results[`home_st_under_${t}`] = sh.home < t;
        results[`away_st_over_${t}`] = sh.away > t;
        results[`away_st_under_${t}`] = sh.away < t;
    });
    return results;
}

const initTrancheObject = () => ({
    '0-59': { success: 0, total: 0, avgPredicted: 0 }, '60-69': { success: 0, total: 0, avgPredicted: 0 }, '70-79': { success: 0, total: 0, avgPredicted: 0 },
    '80-89': { success: 0, total: 0, avgPredicted: 0 }, '90-100': { success: 0, total: 0, avgPredicted: 0 }
});

async function runBacktest() {
    console.log(chalk.blue.bold("--- Démarrage du Job de Backtesting (Version Complète) ---"));
    const season = new Date().getFullYear();
    let detailedResults: any[] = [];
    let totalMatchesAnalyzed = 0;
    let marketOccurrences: { [key: string]: number } = {};
    let trancheAnalysis: { [key: string]: any } = {};
    let earlySeasonTrancheSummary = initTrancheObject();
    let calibrationReport: { [key: string]: any } = {};

    for (const league of LEAGUES_TO_ANALYZE) {
        console.log(chalk.cyan.bold(`\n[Analyse de la ligue] ${league.name}`));

        const finishedMatches = await gestionJourneeService.getMatchesForBacktesting(league.id, season);

        if (finishedMatches && finishedMatches.length > 0) {
            for (const match of finishedMatches) {
                console.log(chalk.green(`\n    Analyse de : ${match.teams.home.name} vs ${match.teams.away.name}`));
                const homeTeamId = match.teams.home.id;
                const awayTeamId = match.teams.away.id;

                const [homeStats, awayStats]: [TeamStats | null, TeamStats | null] = await Promise.all([
                    apiFootballService.getTeamStats(homeTeamId, league.id, season),
                    apiFootballService.getTeamStats(awayTeamId, league.id, season)
                ]);

                if (!homeStats || !awayStats) {
                    console.log(chalk.red(`      -> Stats de base manquantes, match ignoré.`));
                    continue;
                }

                totalMatchesAnalyzed++;

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

                const predictionResult = analyseMatchService.predict(lambdas, homeStats, awayStats, projectedHomeGoals, projectedAwayGoals);
                let confidenceScores = predictionResult.markets;

                const marketResults = analyzeMatchMarkets(match, projectedHomeGoals, projectedAwayGoals);
                if (!marketResults) continue;

                for (const market in marketResults) { if (marketResults[market] === true) { marketOccurrences[market] = (marketOccurrences[market] || 0) + 1; } }

                detailedResults.push({
                    leagueName: league.name,
                    matchLabel: `${match.teams.home.name} vs ${match.teams.away.name}`,
                    isEarlySeason,
                    results: marketResults,
                    scores: confidenceScores
                });

                for (const market in confidenceScores) {
                    if (!marketResults.hasOwnProperty(market)) continue;
                    if (!trancheAnalysis[market]) trancheAnalysis[market] = initTrancheObject();
                    const score = confidenceScores[market];
                    const wasSuccess = marketResults[market];
                    let trancheKey: '0-59' | '60-69' | '70-79' | '80-89' | '90-100';
                    if (score < 60) trancheKey = '0-59';
                    else if (score < 70) trancheKey = '60-69';
                    else if (score < 80) trancheKey = '70-79';
                    else if (score < 90) trancheKey = '80-89';
                    else trancheKey = '90-100';
                    trancheAnalysis[market][trancheKey].total++;
                    trancheAnalysis[market][trancheKey].avgPredicted += score;
                    if (wasSuccess) trancheAnalysis[market][trancheKey].success++;
                    if (isEarlySeason) {
                        earlySeasonTrancheSummary[trancheKey].total++;
                        earlySeasonTrancheSummary[trancheKey].avgPredicted += score;
                        if (wasSuccess) earlySeasonTrancheSummary[trancheKey].success++;
                    }
                }

                await sleep(500);
            }
        }
    }

    try {
        for (const market in trancheAnalysis) {
            if ((marketOccurrences[market] || 0) < 20) {
                delete trancheAnalysis[market];
            }
        }

        const globalTrancheSummary = initTrancheObject();
        for (const market in trancheAnalysis) {
            for (const key in trancheAnalysis[market]) {
                globalTrancheSummary[key as keyof typeof globalTrancheSummary].success += trancheAnalysis[market][key].success;
                globalTrancheSummary[key as keyof typeof globalTrancheSummary].total += trancheAnalysis[market][key].total;
                globalTrancheSummary[key as keyof typeof globalTrancheSummary].avgPredicted += trancheAnalysis[market][key].avgPredicted;
            }
        }
        calibrationReport = {};
        for (const market in trancheAnalysis) {
            calibrationReport[market] = {};
            for (const key in trancheAnalysis[market]) {
                const tranche = trancheAnalysis[market][key];
                if (tranche.total > 0) {
                    tranche.avgPredicted /= tranche.total;
                    calibrationReport[market][key] = {
                        predicted: tranche.avgPredicted.toFixed(2),
                        actual: ((tranche.success / tranche.total) * 100).toFixed(2)
                    };
                }
            }
        }

        for (const key in earlySeasonTrancheSummary) {
            const tranche = earlySeasonTrancheSummary[key as keyof typeof earlySeasonTrancheSummary];
            if (tranche.total > 0) {
                tranche.avgPredicted /= tranche.total;
            }
        }

        const finalReport = { totalMatchesAnalyzed, globalSummary: globalTrancheSummary, perMarketSummary: trancheAnalysis, marketOccurrences, calibration: calibrationReport, earlySeasonSummary: earlySeasonTrancheSummary, detailedResults };
        fs.writeFileSync('bilan_backtest.json', JSON.stringify(finalReport, null, 2));
        console.log(chalk.magenta.bold('\n-> Bilan du backtest sauvegardé dans le fichier bilan_backtest.json'));
    } catch (error) {
        console.error(chalk.red('Erreur lors de la sauvegarde du fichier JSON:'), error);
    }

    console.log(chalk.blue.bold("\n--- Job de Backtesting Terminé ---"));
}

module.exports = { runBacktest };