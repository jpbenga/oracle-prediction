const chalk = require('chalk');
const { firestoreService } = require('../services/Firestore.service');
const { apiFootballService } = require('../services/ApiFootball.service');
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

async function runResultsUpdater() {
  console.log(chalk.blue.bold("--- Démarrage du Job de Mise à Jour des Résultats ---"));

  // 1. Process Predictions
  console.log(chalk.cyan("Vérification des pronostics en attente..."));
  const pendingPredictions = await firestoreService.getPendingPredictions(); // Needs to be implemented

  for (const prediction of pendingPredictions) {
    console.log(chalk.cyan(`  -> Traitement du pronostic : ${prediction.matchLabel} (ID: ${prediction.id})`));
    const matchResult = await apiFootballService.getFixtureResult(prediction.fixtureId); // Needs to be implemented

    if (matchResult && matchResult.status === 'Match Finished') {
      const newStatus = determinePredictionStatus(prediction, matchResult); // Needs to be implemented
      if (newStatus) {
        await firestoreService.updatePrediction(prediction.id, { status: newStatus });
        console.log(chalk.green(`    -> Pronostic ${prediction.id} mis à jour au statut : ${newStatus}`));
      }
    } else {
      console.log(chalk.yellow(`    -> Résultat non disponible ou match non terminé pour ${prediction.id}.`));
    }
  }

  // 2. Process Tickets
  console.log(chalk.cyan("\nVérification des tickets en attente..."));
  const pendingTickets = await firestoreService.getPendingTickets(); // Needs to be implemented

  for (const ticket of pendingTickets) {
    console.log(chalk.cyan(`  -> Traitement du ticket : ${ticket.id}`));
    const allBetsStatus = await Promise.all(ticket.bet_refs.map(async (betRef: any) => {
      const predictionDoc = await betRef.get();
      return predictionDoc.data()?.status; // Assuming betRef is a DocumentReference
    }));

    let newTicketStatus = 'PENDING';
    if (allBetsStatus.every((status: string) => status === 'WON')) {
      newTicketStatus = 'WON';
    } else if (allBetsStatus.some((status: string) => status === 'LOST')) {
      newTicketStatus = 'LOST';
    }

    if (newTicketStatus !== 'PENDING') {
      await firestoreService.updateTicket(ticket.id, { status: newTicketStatus }); // Needs to be implemented
      console.log(chalk.green(`    -> Ticket ${ticket.id} mis à jour au statut : ${newTicketStatus}`));
    }
  }

  console.log(chalk.blue.bold("\n--- Job de Mise à Jour des Résultats Terminé ---"));
}

// Helper function to determine prediction status (needs actual implementation based on market logic)
function determinePredictionStatus(prediction: any, matchResult: any): string | null {
  // This is a placeholder. Actual logic will depend on the 'market' of the prediction
  // and the 'matchResult' (e.g., scores, events).
  // Example: if prediction.market is 'home_win' and matchResult.homeGoals > matchResult.awayGoals, return 'WON'
  // For now, just a dummy return.
  if (Math.random() > 0.5) {
    return 'WON';
  } else {
    return 'LOST';
  }
}

module.exports = { runResultsUpdater };
