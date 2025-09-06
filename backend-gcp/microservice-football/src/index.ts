import express from 'express';
import chalk from 'chalk';
import cors, { CorsOptions } from 'cors';
import { runLeagueOrchestrator } from './jobs/league-orchestrator.job';
import { runPredictionCompleter } from './jobs/prediction-completer.job';
import { runTicketGenerator } from './jobs/ticket-generator.job';
import { runResultsUpdater } from './jobs/results-updater.job';
import { runBacktestOrchestrator } from './jobs/backtest-orchestrator.job';
import { BacktestWorkerMessage, runBacktestWorker } from './jobs/backtest-worker.job';
import { runPrediction } from './jobs/prediction.job';
import { runBacktestSummarizer } from './jobs/backtest-summarizer.job';
import { firestoreService } from './services/Firestore.service';

const app = express();
app.use(express.json());

// --- Configuration CORS ---
const allowedOrigins = [
    'https://oracle-prediction-app.web.app',
    'https://oracle-prediction-app.firebaseapp.com',
    process.env.CORS_ORIGIN || 'http://localhost:4200',
    'https://4200-firebase-oracle-prediction-1756797510260.cluster-64pjnskmlbaxowh5lzq6i7v4ra.cloudworkstations.dev'
];

const corsOptions: CorsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(chalk.yellow(`CORS: Origine refusée: ${origin}`));
            callback(new Error(`Not allowed by CORS: ${origin}`), false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Appliquer CORS avant toutes les routes. C'est LUI qui gère les requêtes OPTIONS.
app.use(cors(corsOptions));


// --- LE RESTE DE VOTRE FICHIER EST PARFAIT ---

const PORT = process.env.PORT || 8080;

// ... (toutes vos routes GET, POST, etc. restent inchangées) ...

// ====================================================================
// ENDPOINT POUR LE JOB SCHEDULER PRINCIPAL (PIPELINE SÉQUENTIEL)
// ====================================================================
app.get('/run-daily-pipeline', async (req, res) => {
    console.log(chalk.magenta.bold('--- Déclenchement du pipeline de jobs quotidien ---'));
    
    // Réponse immédiate pour ne pas faire attendre le client
    res.status(202).send('Le pipeline de jobs quotidien a été démarré.');

    try {
        // Exécution en arrière-plan
        console.log(chalk.blue.bold('\n[PIPELINE - ÉTAPE 1/4] Démarrage du Backtest...'));
        await runBacktestOrchestrator();
        console.log(chalk.blue.bold('\n[PIPELINE - ÉTAPE 2/4] Démarrage de l\'analyse de performance (Summarizer)...'));
        await runBacktestSummarizer();
        console.log(chalk.blue.bold('\n[PIPELINE - ÉTAPE 3/4] Démarrage de la génération des prédictions...'));
        await runPrediction();
        console.log(chalk.blue.bold('\n[PIPELINE - ÉTAPE 4/4] Démarrage de la génération des tickets...'));
        await runTicketGenerator();
        console.log(chalk.blue.bold('\n[PIPELINE - MAINTENANCE] Démarrage des mises à jour...'));
        await runResultsUpdater();
        await runPredictionCompleter();
        await runLeagueOrchestrator();
        console.log(chalk.magenta.bold('\n--- Pipeline de jobs quotidien terminé avec succès ---'));
    } catch (error) {
        console.error(chalk.red('Erreur critique lors de l\'exécution du pipeline :'), error);
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
    runBacktestWorker(messagePayload); 
    res.status(204).send(); 
  } catch (error) {
    console.error(chalk.red('Erreur dans le worker Pub/Sub :'), error);
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
            res.status(404).json({ message: "Aucun ticket trouvé pour cette date." });
        }
    } catch (error) {
        console.error(chalk.red('Erreur /api/tickets:'), error);
        res.status(500).json({ message: "Erreur du serveur." });
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
            res.status(404).json({ message: "Aucune prédiction trouvée pour cette date." });
        }
    } catch (error) {
        console.error(chalk.red('Erreur /api/predictions:'), error);
        res.status(500).json({ message: "Erreur du serveur." });
    }
});


app.listen(PORT, () => {
  console.log(
    chalk.green.bold(`🚀 Le microservice est démarré et écoute sur le port ${PORT}`)
  );
});