import { firestoreService } from '../services/Firestore.service';
import { gestionJourneeService } from '../services/GestionJournee.service';
import { footballConfig } from '../config/football.config';
import chalk from 'chalk';

export async function runLeagueOrchestrator() {
  console.log(chalk.blue('--- Démarrage du League Orchestrator ---'));
  for (const league of footballConfig.leaguesToAnalyze) {
    const status = await firestoreService.getLeagueStatus(String(league.id));
    // ... la suite de votre logique reste la même
  }
  console.log(chalk.blue('--- League Orchestrator Terminé ---'));
}