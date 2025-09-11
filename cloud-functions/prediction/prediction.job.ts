// backend-gcp/microservice-football/src/jobs/prediction.job.ts

import chalk from 'chalk';
import { footballConfig } from '../common/config/football.config';
import { apiFootballService } from '../common/services/ApiFootball.service';
import { gestionJourneeService } from '../common/services/GestionJournee.service';
import { analyseMatchService } from '../common/services/AnalyseMatch.service';
import { firestoreService } from '../common/services/Firestore.service';
import { TrancheAnalysis } from '../common/types/football.types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getTrancheKey(score: number): keyof TrancheAnalysis | null {
    if (score >= 90) return "90-100";
    if (score >= 80) return "80-89";
    if (score >= 70) return "70-79";
    if (score >= 60) return "60-69";
    if (score >= 0) return "0-59";
    return null;
}

// La fonction parseOdds reste nécessaire ici pour traiter les cotes récupérées.
function parseOdds(oddsData: any[]): { [key: string]: number } {
    if (!oddsData || oddsData.length === 0) return {};
    const parsed: { [key: string]: number } = {};
    const fixtureOdds = oddsData[0];
    for (const bookmaker of fixtureOdds.bookmakers) {
        const matchWinnerBet = bookmaker.bets.find((b: any) => b.id === 1);
        const doubleChanceBet = bookmaker.bets.find((b: any) => b.id === 12);
        if (matchWinnerBet) {
            const homeOdd = parseFloat(matchWinnerBet.values.find((v: any) => v.value === 'Home')?.odd);
            const drawOdd = parseFloat(matchWinnerBet.values.find((v: any) => v.value === 'Draw')?.odd);
            const awayOdd = parseFloat(matchWinnerBet.values.find((v: any) => v.value === 'Away')?.odd);
            if (homeOdd && drawOdd && awayOdd) {
                if (!parsed['draw']) parsed['draw'] = drawOdd;
                const isHomeFavorite = homeOdd < awayOdd;
                if (!parsed['favorite_win']) parsed['favorite_win'] = isHomeFavorite ? homeOdd : awayOdd;
                if (!parsed['outsider_win']) parsed['outsider_win'] = isHomeFavorite ? awayOdd : homeOdd;
                if (doubleChanceBet) {
                    const homeDrawOdd = parseFloat(doubleChanceBet.values.find((v: any) => v.value === 'Home/Draw')?.odd);
                    const awayDrawOdd = parseFloat(doubleChanceBet.values.find((v: any) => v.value === 'Draw/Away')?.odd);
                    if (homeDrawOdd && awayDrawOdd) {
                        if (!parsed['double_chance_favorite']) parsed['double_chance_favorite'] = isHomeFavorite ? homeDrawOdd : awayDrawOdd;
                        if (!parsed['double_chance_outsider']) parsed['double_chance_outsider'] = isHomeFavorite ? awayDrawOdd : homeDrawOdd;
                    }
                }
            }
        }
        for (const bet of bookmaker.bets) {
            switch (bet.id) {
                case 5: bet.values.forEach((v: any) => { const k = `match_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 8: bet.values.forEach((v: any) => { const k = v.value === 'Yes' ? 'btts' : 'btts_no'; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 16: bet.values.forEach((v: any) => { const k = `home_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 17: bet.values.forEach((v: any) => { const k = `away_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 6: bet.values.forEach((v: any) => { const k = `ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 26: bet.values.forEach((v: any) => { const k = `st_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 105: bet.values.forEach((v: any) => { const k = `home_ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 106: bet.values.forEach((v: any) => { const k = `away_ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
            }
        }
    }
    return parsed;
}

export async function runPrediction(options?: { leagueId?: string, matchdayNumber?: number }) {
    console.log(chalk.blue.bold("--- Démarrage du Job de Prédiction ---"));
    
    const season = new Date().getFullYear();
    let totalPredictionsSaved = 0;

    const backtestSummary = await firestoreService.getBacktestSummary();
    if (!backtestSummary) {
        console.error(chalk.red("ERREUR CRITIQUE: Bilan de backtest non trouvé. Le job ne peut pas continuer sans données de performance. Exécutez le backtest et le summarizer d'abord."));
        return;
    }
    console.log(chalk.green("Bilan de backtest chargé avec succès. Application de la stratégie de filtrage."));

    let leaguesToProcess = footballConfig.leaguesToAnalyze;
    if (options?.leagueId) {
        const specificLeague = footballConfig.leaguesToAnalyze.find(l => l.id === parseInt(options.leagueId || '', 10));
        if (specificLeague) {
            leaguesToProcess = [specificLeague];
            console.log(chalk.yellow(`Exécution ciblée pour la ligue : ${specificLeague.name}`));
        } else {
            console.error(chalk.red(`Ligue avec ID ${options.leagueId} non trouvée. Arrêt.`));
            return;
        }
    }

    for (const league of leaguesToProcess) {
        console.log(chalk.cyan.bold(`\n[Analyse de la ligue] ${league.name}`));

        const matchday = options?.matchdayNumber || season;
        const upcomingMatches = await gestionJourneeService.getMatchesForPrediction(league.id, matchday);
        
        if (!upcomingMatches || upcomingMatches.length === 0) {
            console.log(chalk.yellow(`Aucun match à venir trouvé pour la ligue ${league.name}. Passage à la suivante.`));
            continue;
        }

        console.log(chalk.cyan(`${upcomingMatches.length} matchs à analyser pour cette ligue.`));

        for (const match of upcomingMatches) {
            console.log(chalk.green(`\n   Calcul pour : ${match.teams.home.name} vs ${match.teams.away.name}`));

            const analysisResult = await analyseMatchService.analyseMatch(match);

            if (analysisResult && analysisResult.markets) {
                const confidenceScores = analysisResult.markets;
                
                const maxConfidence = Math.max(...Object.values(confidenceScores));
                if (maxConfidence < 60) {
                    console.warn(`       -> Match exclu : aucune prédiction avec confiance \u2265 60%.`);
                    continue;
                }

                const oddsData = await apiFootballService.getOddsForFixture(match.fixture.id);
                const parsedOdds = parseOdds(oddsData || []);
                
                let savedCount = 0;
                for (const market in confidenceScores) {
                    const score = confidenceScores[market];
                    if (typeof score === 'undefined' || score < 60) continue;

                    const trancheKey = getTrancheKey(score);
                    if (!trancheKey) continue;

                    const marketStats = backtestSummary.perMarketSummary[market]?.[trancheKey];
                    const successRate = marketStats && marketStats.total > 0 ? (marketStats.success / marketStats.total) * 100 : 0;

                    if (successRate < 85) {
                        console.log(chalk.gray(`       -> Marché ${market} (score: ${score.toFixed(2)}%) filtré. Taux de succès historique: ${successRate.toFixed(2)}%`));
                        continue;
                    }
                     console.log(chalk.green.bold(`       -> Marché ${market} (score: ${score.toFixed(2)}%) VALIDÉ. Taux de succès historique: ${successRate.toFixed(2)}%`));


                    const odd = parsedOdds[market];
                    const status = odd ? 'ELIGIBLE' : 'INCOMPLETE';

                    const predictionData = {
                        fixtureId: match.fixture.id,
                        matchLabel: `${match.teams.home.name} vs ${match.teams.away.name}`,
                        matchDate: new Date(match.fixture.date).toISOString(),
                        leagueId: league.id,
                        leagueName: league.name,
                        market: market,
                        score: score,
                        odd: odd || null,
                        status: status,
                        createdAt: new Date().toISOString()
                    };

                    await firestoreService.savePrediction(predictionData);
                    savedCount++;
                }
                
                if (savedCount > 0) {
                    console.log(chalk.magenta(`         -> ${savedCount} prédictions sauvegardées dans Firestore.`));
                    totalPredictionsSaved += savedCount;
                }

                await sleep(500);
            }
        }
    }
    
    console.log(chalk.blue.bold(`\n--- Total de ${totalPredictionsSaved} prédictions sauvegardées ---`));
    console.log(chalk.blue.bold("--- Job de Prédiction Terminé ---"));
}
