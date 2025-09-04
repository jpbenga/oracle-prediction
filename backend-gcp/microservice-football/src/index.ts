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
// ENDPOINT POUR LE JOB SCHEDULER PRINCIPAL
// ====================================================================
app.get('/run-all-jobs', async (req, res) => {
  console.log(chalk.magenta.bold('--- Déclenchement de la séquence de jobs ---'));
  try {
    // L'orchestrateur de backtest est rapide, il ne fait que publier des messages.
    await runBacktestOrchestrator();

    // Les autres jobs sont également rapides et peuvent être lancés en parallèle.
    await Promise.all([
      runLeagueOrchestrator(),
      runPredictionCompleter(),
      runTicketGenerator(),
      runResultsUpdater(),
    ]);

    res.status(202).send('La séquence de jobs a été démarrée avec succès. Les workers de backtest s\'exécuteront en arrière-plan.');
  } catch (error) {
    console.error(chalk.red('Erreur lors du déclenchement des jobs :'), error);
    res.status(500).send('Échec du démarrage des jobs.');
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
// ENDPOINT POUR LE JOB SCHEDULER SECONDAIRE (RÉSUMÉ)
// ====================================================================
app.get('/run-backtest-summarizer', async (req, res) => {
    console.log(chalk.magenta.bold('--- Déclenchement du job de résumé du backtest ---'));
    try {
        await runBacktestSummarizer();
        res.status(200).send('Le résumé du backtest a été généré avec succès.');
    } catch (error) {
        console.error(chalk.red('Erreur lors de la génération du résumé du backtest :'), error);
        res.status(500).send('Échec de la génération du résumé.');
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
            res.status(404).json({ message: "Aucun ticket trouvé pour cette date." });
        }
    } catch (error) {
        res.status(500).json({ message: "Erreur du serveur." });
    }
});

app.get('/api/predictions', async (req, res) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
        const predictions = await firestoreService.getPredictionsForDate(date);
        if (predictions.length > 0) {
            res.status(200).json(predictions);
        } else {
            res.status(404).json({ message: "Aucune prédiction trouvée pour cette date." });
        }
    } catch (error) {
        res.status(500).json({ message: "Erreur du serveur." });
    }
});


app.listen(PORT, () => {
  console.log(
    chalk.green.bold(`🚀 Le microservice est démarré et écoute sur le port ${PORT}`)
  );
});