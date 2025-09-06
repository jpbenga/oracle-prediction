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

console.log(chalk.blue.bold('--- Démarrage du fichier index.ts ---'));

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
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Appliquer le middleware CORS en premier
app.use(cors(corsOptions));

// Journalisation détaillée des requêtes
app.use((req, res, next) => {
    console.log(chalk.cyan.bold('\n--- NOUVELLE REQUÊTE ---'));
    console.log(chalk.cyan(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`));
    console.log(chalk.cyan('Origin:'), req.headers.origin || 'none');
    console.log(chalk.cyan('Headers:'), JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
        console.log(chalk.cyan('Body:'), JSON.stringify(req.body, null, 2));
    }
    console.log(chalk.cyan.bold('\n--- FIN DE LA REQUÊTE ---\n'));
    next();
});


const PORT = process.env.PORT || 8080;

// ====================================================================
// ROUTES DE L'APPLICATION
// ====================================================================

app.get('/run-daily-pipeline', async (req, res) => {
    console.log(chalk.magenta.bold('--- Déclenchement du pipeline de jobs quotidien ---'));
    res.status(202).json({ message: 'Pipeline démarré avec succès' });

    try {
        await runBacktestOrchestrator();
        await runBacktestSummarizer();
        await runPrediction();
        await runTicketGenerator();
        await runResultsUpdater();
        await runPredictionCompleter();
        await runLeagueOrchestrator();
        console.log(chalk.magenta.bold('\n--- Pipeline de jobs quotidien terminé avec succès ---'));
    } catch (error) {
        console.error(chalk.red('Erreur critique lors de l\'exécution du pipeline :'), error);
    }
});

app.post('/pubsub-backtest-worker', async (req, res) => {
    if (!req.body || !req.body.message) {
        return res.status(400).json({ error: 'Requête invalide' });
    }
    try {
        const messageData = Buffer.from(req.body.message.data, 'base64').toString('utf-8');
        const messagePayload = JSON.parse(messageData) as BacktestWorkerMessage;
        runBacktestWorker(messagePayload);
        res.status(204).send();
    } catch (error) {
        console.error(chalk.red('Erreur dans le worker Pub/Sub :'), error);
        res.status(500).json({ error: 'Échec du traitement' });
    }
});

app.get('/api/tickets', async (req, res) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
        const tickets = await firestoreService.getTicketsForDate(date);
        if (tickets.length > 0) {
            res.status(200).json({ success: true, data: tickets });
        } else {
            res.status(404).json({ success: false, message: `Aucun ticket trouvé pour la date ${date}` });
        }
    } catch (error) {
        console.error(chalk.red('Erreur /api/tickets:'), error);
        res.status(500).json({ success: false, message: "Erreur interne" });
    }
});

app.get('/api/predictions', async (req, res) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
        const predictions = await firestoreService.getPredictionsForDate(date);
        if (predictions.length > 0) {
            res.status(200).json({ success: true, data: predictions });
        } else {
            res.status(404).json({ success: false, message: `Aucune prédiction trouvée pour la date ${date}` });
        }
    } catch (error) {
        console.error(chalk.red('Erreur /api/predictions:'), error);
        res.status(500).json({ success: false, message: "Erreur interne" });
    }
});

app.get('/health', (req, res) => {
    console.log(chalk.green('--- Réponse du Health Check ---'));
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ====================================================================
// GESTION DES ERREURS (DOIT ÊTRE À LA FIN)
// ====================================================================

app.use((req, res, next) => {
    console.log(chalk.yellow.bold(`--- ROUTE NON TROUVÉE ---`));
    console.log(chalk.yellow(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`));
    res.status(404).json({
        success: false,
        message: `Route non trouvée: ${req.method} ${req.path}`
    });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(chalk.red.bold('--- ERREUR NON GÉRÉE ---'), err);
    res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
    });
});

app.listen(PORT, () => {
    console.log(chalk.green.bold(`🚀 Le microservice est démarré et écoute sur le port ${PORT}`));
});
