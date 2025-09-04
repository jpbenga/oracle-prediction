// backend-gcp/microservice-football/src/index.ts

import express from 'express';
import chalk from 'chalk';
import cors from 'cors'; // Ajout de l'import pour CORS
import { runLeagueOrchestrator } from './jobs/league-orchestrator.job';
import { runPredictionCompleter } from './jobs/prediction-completer.job';
import { runTicketGenerator } from './jobs/ticket-generator.job';
import { runResultsUpdater } from './jobs/results-updater.job';
import { runBacktestOrchestrator } from './jobs/backtest-orchestrator.job';
import { BacktestWorkerMessage, runBacktestWorker } from './jobs/backtest-worker.job';
import { runPrediction } from './jobs/prediction.job';
import { runBacktestSummarizer } from './jobs/backtest-summarizer.job';
import { firestoreService } from './services/Firestore.service';

import { CorsOptions } from 'cors';

const app = express();
app.use(express.json());

// --- Configuration CORS ---
// ... (votre configuration CORS reste la même)
const allowedOrigins = [
    process.env.CORS_ORIGIN || 'http://localhost:4200',
    'https://4200-firebase-oracle-prediction-1756797510260.cluster-64pjnskmlbaxowh5lzq6i7v4ra.cloudworkstations.dev'
];
const corsOptions: CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'), false);
        }
    },
};
app.use(cors(corsOptions));


const PORT = process.env.PORT || 8080;

// ====================================================================
// ENDPOINT POUR LE JOB SCHEDULER PRINCIPAL (PIPELINE SÉQUENTIEL)
// ====================================================================
app.get('/run-daily-pipeline', async (req, res) => {
  console.log(chalk.magenta.bold('--- Déclenchement du pipeline de jobs quotidien ---'));
  try {
    // ÉTAPE 1: Collecte des données de backtest et analyse de performance
    console.log(chalk.blue.bold('\n[PIPELINE - ÉTAPE 1/4] Démarrage du Backtest...'));
    await runBacktestOrchestrator();
    console.log(chalk.blue.bold('\n[PIPELINE - ÉTAPE 2/4] Démarrage de l\'analyse de performance (Summarizer)...'));
    await runBacktestSummarizer();

    // ÉTAPE 2: Génération des prédictions et des tickets pour le jour J
    console.log(chalk.blue.bold('\n[PIPELINE - ÉTAPE 3/4] Démarrage de la génération des prédictions...'));
    await runPrediction(); // Note: Assurez-vous que runPrediction est importé
    console.log(chalk.blue.bold('\n[PIPELINE - ÉTAPE 4/4] Démarrage de la génération des tickets...'));
    await runTicketGenerator();

    // ÉTAPE 3: Tâches de maintenance (mises à jour des résultats passés)
    console.log(chalk.blue.bold('\n[PIPELINE - MAINTENANCE] Démarrage des mises à jour...'));
    await runResultsUpdater();
    await runPredictionCompleter();
    await runLeagueOrchestrator();

    console.log(chalk.magenta.bold('\n--- Pipeline de jobs quotidien terminé avec succès ---'));
    res.status(200).send('Le pipeline de jobs quotidien a été exécuté avec succès.');

  } catch (error) {
    console.error(chalk.red('Erreur critique lors de l\'exécution du pipeline :'), error);
    res.status(500).send('Échec de l\'exécution du pipeline.');
  }
});

// ====================================================================
// ENDPOINT POUR LE WORKER (DÉCLENCHÉ PAR PUB/SUB)
// ====================================================================
app.post('/pubsub-backtest-worker', async (req, res) => {
  if (!req.body || !req.body.message) {
    const errorMessage = 'Requête invalide : corps ou message manquant.';
    console.error(chalk.red(errorMessage));
    return res.status(400).send(errorMessage);
  }

  try {
    const messageData = Buffer.from(req.body.message.data, 'base64').toString('utf-8');
    const messagePayload = JSON.parse(messageData) as BacktestWorkerMessage;

    // Lancement du worker. On ne met PAS await pour que la réponse soit immédiate.
    // Cloud Run gérera l'exécution en arrière-plan.
    runBacktestWorker(messagePayload); 
    
    // On répond immédiatement à Pub/Sub pour qu'il sache que le message a été reçu.
    res.status(204).send(); 
  } catch (error) {
    console.error(chalk.red('Erreur dans le worker Pub/Sub :'), error);
    // On répond avec une erreur pour que Pub/Sub puisse tenter de renvoyer le message.
    res.status(500).send('Échec du traitement du message.');
  }
});

// ====================================================================
// ROUTES API POUR LE FRONT-END
// ====================================================================
app.get('/api/tickets', async (req, res) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
        const tickets = await firestoreService.getTicketsForDate(date);
        if (tickets.length > 0) {
            res.status(200).json(tickets);
        } else {
            res.status(404).json({
                message: "Aucun ticket trouvé pour cette date."
            });
        }
    } catch (error) {
        res.status(500).json({
            message: "Erreur du serveur."
        });
    }
});

app.get('/api/predictions', async (req, res) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
        const predictions = await firestoreService.getPredictionsForDate(date);
        if (predictions.length > 0) {
            res.status(200).json(predictions);
        }
        else {
            res.status(404).json({
                message: "Aucune prédiction trouvée pour cette date."
            });
        }
    } catch (error) {
        res.status(500).json({
            message: "Erreur du serveur."
        });
    }
});


app.listen(PORT, () => {
  console.log(
    chalk.green.bold(`🚀 Le microservice est démarré et écoute sur le port ${PORT}`)
  );
});