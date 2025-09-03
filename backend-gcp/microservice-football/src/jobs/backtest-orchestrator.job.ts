// backend-gcp/microservice-football/src/jobs/backtest-orchestrator.job.ts

import { PubSub } from '@google-cloud/pubsub';
import chalk from 'chalk';
import { apiFootballService } from '../services/ApiFootball.service';

// Initialise le client Pub/Sub
const pubSubClient = new PubSub();
// Le nom de ton sujet Pub/Sub (tu devras le créer dans la console GCP)
const topicName = 'backtest-jobs';

export async function runBacktestOrchestrator() {
  console.log(chalk.blue('--- Démarrage du Backtest Orchestrator ---'));

  try {
    // 1. Définir la période de backtest (7 jours glissants)
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 8);
    const toDate = new Date(today);
    toDate.setDate(today.getDate() - 1);

    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];

    console.log(
      chalk.cyan(
        `Récupération des matchs terminés du ${fromDateStr} au ${toDateStr}...`
      )
    );

    // 2. Récupérer tous les matchs de la période
    const allMatches = await apiFootballService.getMatchesByDateRange(
      fromDateStr,
      toDateStr
    );

    if (!allMatches || allMatches.length === 0) {
      console.log(chalk.yellow('Aucun match trouvé pour la période.'));
      return;
    }

    console.log(chalk.green(`${allMatches.length} matchs trouvés.`));
    console.log(chalk.cyan('Publication des tâches de backtest dans Pub/Sub...'));

    let publishedCount = 0;
    const promises = allMatches.map(async (match: { fixture: { id: any; }; }) => {
      // 3. Pour chaque match, publier un message dans Pub/Sub
      const messageData = JSON.stringify({ matchId: match.fixture.id });
      const dataBuffer = Buffer.from(messageData);

      try {
        const messageId = await pubSubClient
          .topic(topicName)
          .publishMessage({ data: dataBuffer });
        // console.log(`   -> Message ${messageId} publié pour le match ${match.fixture.id}.`);
        publishedCount++;
      } catch (error) {
        console.error(
          chalk.red(
            `Erreur lors de la publication du message pour le match ${match.fixture.id}:`
          ),
          error
        );
      }
    });

    await Promise.all(promises);

    console.log(
      chalk.green.bold(
        `\nSUCCÈS : ${publishedCount}/${allMatches.length} tâches de backtest ont été publiées dans le sujet "${topicName}".`
      )
    );
    console.log(chalk.blue('--- Backtest Orchestrator Terminé ---'));
  } catch (error) {
    console.error(
      chalk.red.bold('Une erreur critique est survenue dans le Backtest Orchestrator :'),
      error
    );
  }
}