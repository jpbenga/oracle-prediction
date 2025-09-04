// backend-gcp/microservice-football/src/jobs/backtest-orchestrator.job.ts

import { PubSub } from '@google-cloud/pubsub';
import chalk from 'chalk';
import { apiFootballService } from '../services/ApiFootball.service';
import { footballConfig } from '../config/football.config';
import { Match } from '../types/football.types';

const pubSubClient = new PubSub();
const topicName = 'backtest-jobs';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runBacktestOrchestrator() {
  console.log(chalk.blue('--- Démarrage du Backtest Orchestrator ---'));

  try {
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 8);
    const toDate = new Date(today);
    toDate.setDate(today.getDate() - 1);

    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];
    const season = today.getFullYear();

    console.log(chalk.cyan(`Récupération des matchs terminés du ${fromDateStr} au ${toDateStr} pour ${footballConfig.leaguesToAnalyze.length} ligues...`));

    let allMatches: Match[] = [];
    for (const league of footballConfig.leaguesToAnalyze) {
      const matchesForLeague = await apiFootballService.getMatchesByDateRange(
        fromDateStr,
        toDateStr,
        league.id,
        season
      );
      if (matchesForLeague) {
        allMatches = allMatches.concat(matchesForLeague);
      }
    }

    if (allMatches.length === 0) {
      console.log(chalk.yellow('Aucun match trouvé pour la période pour aucune des ligues configurées.'));
      return;
    }

    console.log(chalk.green(`${allMatches.length} matchs trouvés au total.`));
    console.log(chalk.cyan('Récupération des détails complets pour chaque match et publication dans Pub/Sub...'));

    let publishedCount = 0;
    for (const match of allMatches) {
      const matchLabel = `${match.teams.home.name} vs ${match.teams.away.name}`;
      const matchDetails = await apiFootballService.getMatchById(match.fixture.id);
      
      if (matchDetails) {
        if (matchDetails.fixture.status.short === 'FT') {
          const messageData = JSON.stringify({ match: matchDetails });
          const dataBuffer = Buffer.from(messageData);

          try {
            await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
            publishedCount++;
          } catch (error) {
            console.error(chalk.red(`Erreur lors de la publication du message pour le match ${matchLabel} (ID: ${match.fixture.id}):`), error);
          }
        } else {
          console.log(chalk.yellow(`  -> Match "${matchLabel}" (ID: ${match.fixture.id}) ignoré car son statut est '${matchDetails.fixture.status.short}' (attendu: 'FT').`));
        }
      } else {
        console.log(chalk.red(`  -> Match "${matchLabel}" (ID: ${match.fixture.id}) non trouvé via l'API (après ${footballConfig.maxApiAttempts} tentatives). Ignoré.`));
      }
      // Pause pour respecter le rate limiting de l'API
      await sleep(200); 
    }

    console.log(chalk.green.bold(`
SUCCÈS : ${publishedCount}/${allMatches.length} tâches de backtest ont été publiées dans le sujet "${topicName}".`));
    console.log(chalk.blue('--- Backtest Orchestrator Terminé ---'));
  } catch (error) {
    console.error(chalk.red.bold('Une erreur critique est survenue dans le Backtest Orchestrator :'), error);
  }
}
