process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const chalk = require('chalk');
const { firestoreService } = require('../services/Firestore.service');
const { runPrediction } = require('./prediction.job');

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
        currentMatchdayNumber: nextMatchdayNumber, // Important: Mettre à jour le numéro de la journée en cours
        lastAnalysisTimestamp: new Date().toISOString()
      });
      console.log(chalk.green(`  -> Statut de la ligue ${league.id} mis à jour : ANALYZING journée ${nextMatchdayNumber}.`));

    } else {
      console.log(chalk.yellow(`  -> Journée ${league.currentMatchdayNumber} est ${league.currentMatchdayStatus}. Pas d'action nécessaire pour l'instant.`));
    }
  }
  console.log(chalk.blue.bold("\n--- Job d'Orchestration des Ligues Terminé ---"));
}

runLeagueOrchestrator();

module.exports = { runLeagueOrchestrator };