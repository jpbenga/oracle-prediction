process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

const chalk = require('chalk');
const { firestoreService } = require('../services/Firestore.service');
const { runPrediction } = require('./prediction.job');

// Assuming prediction.job exports runPrediction
async function runLeagueOrchestrator() {
  console.log(chalk.blue.bold("--- Démarrage du Job d'Orchestration des Ligues ---"));
  const leagues = await firestoreService.getAllLeaguesStatus();
  for (const league of leagues) {
    console.log(chalk.cyan(`\n[Orchestrateur] Vérification de la ligue : ${league.leagueName} (ID: ${league.id})`));
    if (league.currentMatchdayStatus === 'COMPLETED') {
      console.log(chalk.green(`  -> Journée ${league.currentMatchdayNumber} COMPLETED. Déclenchement du prediction-job pour la prochaine journée.`));
      const nextMatchdayNumber = league.currentMatchdayNumber + 1;
      await runPrediction({ leagueId: league.id, matchdayNumber: nextMatchdayNumber });

      // Update status to ANALYZING to prevent re-triggering until analysis is done
      await firestoreService.updateLeagueStatus(league.id, {
        currentMatchdayStatus: 'ANALYZING',
        lastAnalysisTimestamp: new Date().toISOString()
      });
    } else {
      console.log(chalk.yellow(`  -> Journée ${league.currentMatchdayNumber} est ${league.currentMatchdayStatus}. Pas d'action nécessaire pour l'instant.`));
    }
  }
  console.log(chalk.blue.bold("\n--- Job d'Orchestration des Ligues Terminé ---"));
}

module.exports = { runLeagueOrchestrator };
