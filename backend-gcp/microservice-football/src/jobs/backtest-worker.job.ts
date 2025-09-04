// backend-gcp/microservice-football/src/jobs/backtest-worker.job.ts

import chalk from 'chalk';
import { analyseMatchService } from '../services/AnalyseMatch.service';
import { firestoreService } from '../services/Firestore.service';
import { Match, BacktestResult } from '../types/football.types';
import { apiFootballService } from '../services/ApiFootball.service';

export interface BacktestWorkerMessage {
  matchId: number;
}

/**
 * Détermine les résultats réels de tous les marchés possibles à partir des données d'un match terminé.
 * @param match - L'objet complet du match terminé.
 * @returns Un objet où les clés sont les marchés et les valeurs sont des booléens (vrai si le marché est gagnant).
 */
function determineActualMarketResults(match: Match): { [key: string]: boolean } | null {
    const { goals: finalScore, score } = match;

    if (finalScore.home === null || finalScore.away === null || score.halftime.home === null || score.halftime.away === null) {
        return null;
    }

    // Après la garde, TypeScript sait que ces valeurs ne sont pas nulles.
    // On les assigne à des constantes pour plus de clarté.
    const ffHome = finalScore.home;
    const ffAway = finalScore.away;
    const fhHome = score.halftime.home;
    const fhAway = score.halftime.away;

    const results: { [key: string]: boolean } = {};
    const sh = { home: ffHome - fhHome, away: ffAway - fhAway };

    results['home_win'] = ffHome > ffAway;
    results['away_win'] = ffAway > ffHome;
    results['draw'] = ffHome === ffAway;
    results['btts'] = ffHome > 0 && ffAway > 0;
    results['btts_no'] = !results['btts'];

    [0.5, 1.5, 2.5, 3.5].forEach(t => {
        results[`match_over_${t}`] = ffHome + ffAway > t;
        results[`match_under_${t}`] = ffHome + ffAway < t;
        results[`ht_over_${t}`] = fhHome + fhAway > t;
        results[`ht_under_${t}`] = fhHome + fhAway < t;
        results[`st_over_${t}`] = sh.home + sh.away > t;
        results[`st_under_${t}`] = sh.home + sh.away < t;
        results[`home_over_${t}`] = ffHome > t;
        results[`home_under_${t}`] = ffHome < t;
        results[`away_over_${t}`] = ffAway > t;
        results[`away_under_${t}`] = ffAway < t;
        results[`home_ht_over_${t}`] = fhHome > t;
        results[`home_ht_under_${t}`] = fhHome < t;
        results[`away_ht_over_${t}`] = fhAway > t;
        results[`away_ht_under_${t}`] = fhAway < t;
        results[`home_st_over_${t}`] = sh.home > t;
        results[`home_st_under_${t}`] = sh.home < t;
        results[`away_st_over_${t}`] = sh.away > t;
        results[`away_st_under_${t}`] = sh.away < t;
    });
    return results;
}


export async function runBacktestWorker(message: BacktestWorkerMessage) {
  const { matchId } = message;
  if (!matchId) {
    console.error(chalk.red('Erreur : ID de match manquant dans le message.'));
    return;
  }

  console.log(chalk.blue(`--- [Worker] Démarrage de l'analyse pour le match ID: ${matchId} ---`));

  try {
    const matchDetails = await apiFootballService.getMatchById(matchId);
    if (!matchDetails || matchDetails.fixture.status.short !== 'FT') {
      console.error(chalk.red(`[Worker] Match ${matchId} non trouvé ou non terminé.`));
      return;
    }

    const matchLabel = `${matchDetails.teams.home.name} vs ${matchDetails.teams.away.name}`;
    console.log(chalk.cyan(`[Worker] Analyse de : ${matchLabel}`));

    // 1. Obtenir les prédictions de confiance via le service centralisé
    const analysisResult = await analyseMatchService.analyseMatch(matchDetails);
    if (!analysisResult || !analysisResult.markets) {
        console.log(chalk.yellow(`[Worker] -> L'analyse n'a produit aucun marché pour le match ${matchId}.`));
        return;
    }
    const predictedMarkets = analysisResult.markets;

    // 2. Déterminer les résultats réels du match
    const actualResults = determineActualMarketResults(matchDetails);
    if (!actualResults) {
        console.log(chalk.yellow(`[Worker] -> Impossible de déterminer les résultats réels pour le match ${matchId} (données de score manquantes).`));
        return;
    }

    // 3. Comparer les prédictions aux résultats et construire l'objet de backtest
    const backtestData: BacktestResult = {
        matchId: matchId,
        matchLabel: matchLabel,
        matchDate: new Date(matchDetails.fixture.date).toISOString(),
        markets: [],
    };

    for (const market in predictedMarkets) {
        const predictionScore = predictedMarkets[market];
        const actualResult = actualResults[market];

        if (predictionScore !== undefined && actualResult !== undefined) {
            // On enregistre TOUS les marchés, sans filtre de score, pour une analyse complète.
            backtestData.markets.push({
                market: market,
                prediction: predictionScore,
                // Le résultat est "WON" si la prédiction (implicitement "vrai") correspond au résultat réel (qui est "vrai")
                result: actualResult ? 'WON' : 'LOST',
            });
        }
    }

    if (backtestData.markets.length > 0) {
      await firestoreService.saveBacktestResult(backtestData);
      console.log(chalk.green(`[Worker] -> Résultat du backtest pour le match ${matchId} sauvegardé avec ${backtestData.markets.length} marchés.`));
    } else {
      console.log(chalk.yellow(`[Worker] -> Pas de résultat de backtest à sauvegarder pour ${matchId} (aucun marché analysé).`));
    }

    console.log(chalk.blue.bold(`--- [Worker] Analyse du match ${matchId} terminée avec succès. ---`));
  } catch (error) {
    console.error(chalk.red.bold(`[Worker] Une erreur critique est survenue lors de l'analyse du match ${matchId}:`), error);
    throw error;
  }
}
