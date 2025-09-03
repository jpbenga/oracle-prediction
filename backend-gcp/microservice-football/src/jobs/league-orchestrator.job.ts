import chalk from 'chalk';
import { firestoreService } from '../services/Firestore.service';
import { runPrediction } from './prediction.job';

export async function runLeagueOrchestrator() {
    console.log(chalk.blue.bold("--- Démarrage du Job d'Orchestration des Ligues ---"));
    const leagues = await firestoreService.getAllLeaguesStatus();

    if (!leagues || leagues.length === 0) {
        console.log(chalk.yellow("Aucun statut de ligue trouvé dans Firestore. Pas d'orchestration possible."));
        console.log(chalk.blue.bold("--- Job d'Orchestration des Ligues Terminé ---"));
        return;
    }

    console.log(chalk.cyan(`${leagues.length} statuts de ligues trouvés pour vérification.`));

    for (const league of leagues) {
        console.log(chalk.cyan(`\n[Orchestrateur] Vérification de la ligue : ${league.leagueName} (ID: ${league.id})`));
        
        if (league.currentMatchdayStatus === 'COMPLETED') {
            console.log(chalk.green(`  -> Journée ${league.currentMatchdayNumber} COMPLETED. Déclenchement du prediction-job pour la prochaine journée.`));
            
            const nextMatchdayNumber = league.currentMatchdayNumber + 1;
            await runPrediction({ leagueId: league.id, matchdayNumber: nextMatchdayNumber });

            await firestoreService.updateLeagueStatus(league.id, {
                currentMatchdayStatus: 'ANALYZING',
                currentMatchdayNumber: nextMatchdayNumber,
                lastAnalysisTimestamp: new Date().toISOString()
            });
            console.log(chalk.green(`  -> Statut de la ligue ${league.id} mis à jour : ANALYZING journée ${nextMatchdayNumber}.`));

        } else {
            console.log(chalk.yellow(`  -> Journée ${league.currentMatchdayNumber} est ${league.currentMatchdayStatus}. Pas d'action nécessaire pour l'instant.`));
        }
    }
    console.log(chalk.blue.bold("\n--- Job d'Orchestration des Ligues Terminé ---"));
}