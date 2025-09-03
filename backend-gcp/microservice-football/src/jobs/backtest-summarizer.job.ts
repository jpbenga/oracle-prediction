// backend-gcp/microservice-football/src/jobs/backtest-summarizer.job.ts

import chalk from 'chalk';
import { firestoreService } from '../services/Firestore.service';
import { BacktestResult, TrancheAnalysis, BacktestBilan } from '../types/football.types';

/**
 * Retourne la clé de la tranche de confiance pour un score donné.
 * @param score - Le score de confiance (0-100).
 * @returns La clé de la tranche (ex: "80-89").
 */
function getTrancheKey(score: number): keyof TrancheAnalysis | null {
    if (score >= 90) return "90-100";
    if (score >= 80) return "80-89";
    if (score >= 70) return "70-79";
    if (score >= 60) return "60-69";
    if (score >= 0) return "0-59";
    return null;
}

/**
 * Initialise un objet TrancheAnalysis vide.
 */
const initTrancheAnalysis = (): TrancheAnalysis => ({
    '0-59': { success: 0, total: 0, avgPredicted: 0 },
    '60-69': { success: 0, total: 0, avgPredicted: 0 },
    '70-79': { success: 0, total: 0, avgPredicted: 0 },
    '80-89': { success: 0, total: 0, avgPredicted: 0 },
    '90-100': { success: 0, total: 0, avgPredicted: 0 },
});

export async function runBacktestSummarizer() {
    console.log(chalk.blue.bold("--- Démarrage du Job d'Agrégation du Backtest ---"));

    // 1. Récupérer tous les résultats de backtest individuels
    const allBacktestResults = await firestoreService.getAllBacktestResults();

    if (allBacktestResults.length === 0) {
        console.log(chalk.yellow("Aucun résultat de backtest trouvé. Arrêt du job."));
        return;
    }

    console.log(chalk.cyan(`Agrégation de ${allBacktestResults.length} résultats de backtest...`));

    // 2. Agréger les résultats
    const summary: BacktestBilan = {
        totalMatchesAnalyzed: allBacktestResults.length,
        perMarketSummary: {},
        // Les autres champs seront calculés à la fin
        globalSummary: initTrancheAnalysis(),
        marketOccurrences: {},
        calibration: {},
        earlySeasonSummary: initTrancheAnalysis(), // Note: la logique earlySeason n'est pas portée ici pour l'instant
    };

    for (const result of allBacktestResults) {
        for (const marketData of result.markets) {
            const { market, prediction, result: winStatus } = marketData;

            // Initialiser le marché s'il n'existe pas
            if (!summary.perMarketSummary[market]) {
                summary.perMarketSummary[market] = initTrancheAnalysis();
            }

            const trancheKey = getTrancheKey(prediction);
            if (trancheKey) {
                const tranche = summary.perMarketSummary[market][trancheKey];
                tranche.total++;
                tranche.avgPredicted += prediction;
                if (winStatus === 'WON') {
                    tranche.success++;
                }
            }
        }
    }

    // 3. Calculer les moyennes et les taux de réussite
    for (const market in summary.perMarketSummary) {
        for (const key in summary.perMarketSummary[market]) {
            const trancheKey = key as keyof TrancheAnalysis;
            const tranche = summary.perMarketSummary[market][trancheKey];
            if (tranche.total > 0) {
                tranche.avgPredicted /= tranche.total;
            }
        }
    }

    console.log(chalk.green("Agrégation terminée."));

    // 4. Sauvegarder le bilan consolidé dans Firestore
    await firestoreService.saveBacktestSummary(summary);
    console.log(chalk.magenta.bold("-> Bilan du backtest sauvegardé avec succès dans Firestore."));

    console.log(chalk.blue.bold("--- Job d'Agrégation du Backtest Terminé ---"));
}
