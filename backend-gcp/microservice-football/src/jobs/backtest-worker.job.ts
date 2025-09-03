// backend-gcp/microservice-football/src/jobs/backtest-worker.job.ts

import chalk from 'chalk';
import { analyseMatchService } from '../services/AnalyseMatch.service';
import { firestoreService } from '../services/Firestore.service';
import { Match } from '../types/football.types';
import { apiFootballService } from '../services/ApiFootball.service';

// Interface pour le message reçu de Pub/Sub
export interface BacktestWorkerMessage {
  matchId: number;
}

export async function runBacktestWorker(message: BacktestWorkerMessage) {
  const { matchId } = message;
  if (!matchId) {
    console.error(chalk.red('Erreur : ID de match manquant dans le message.'));
    return;
  }

  console.log(
    chalk.blue(`--- [Worker] Démarrage de l'analyse pour le match ID: ${matchId} ---`)
  );

  try {
    // 1. Récupérer les détails complets du match à partir de son ID
    const matchDetails = await apiFootballService.getMatchById(matchId);
    if (!matchDetails) {
      console.error(chalk.red(`[Worker] Match ${matchId} non trouvé.`));
      return;
    }

    const matchLabel = `${matchDetails.teams.home.name} vs ${matchDetails.teams.away.name}`;
    console.log(chalk.cyan(`[Worker] Analyse de : ${matchLabel}`));

    // 2. Lancer l'analyse du match (c'est la logique que vous aviez déjà)
    const backtestResult = await analyseMatchService.analyseMatch(matchDetails, {
      isBacktest: true,
    });

    if (backtestResult && backtestResult.markets.length > 0) {
      // 3. Sauvegarder le résultat dans Firestore
      await firestoreService.saveBacktestResult(backtestResult);
      console.log(
        chalk.green(
          `[Worker] -> Résultat du backtest pour le match ${matchId} sauvegardé.`
        )
      );
    } else {
      console.log(
        chalk.yellow(`[Worker] -> Pas de résultat de backtest à sauvegarder pour ${matchId}.`)
      );
    }

    console.log(
      chalk.blue.bold(`--- [Worker] Analyse du match ${matchId} terminée avec succès. ---`)
    );
  } catch (error) {
    console.error(
      chalk.red.bold(
        `[Worker] Une erreur critique est survenue lors de l'analyse du match ${matchId}:`
      ),
      error
    );
    // On relance l'erreur pour que Pub/Sub puisse tenter de retraiter le message
    throw error;
  }
}