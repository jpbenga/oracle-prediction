import express from 'express';
import cors from 'cors';
import { runLeagueOrchestrator } from './jobs/league-orchestrator.job';
import { runPredictionCompleter } from './jobs/prediction-completer.job';
import { runTicketGenerator } from './jobs/ticket-generator.job';
import { runResultsUpdater } from './jobs/results-updater.job';
import { runBacktestOrchestrator } from './jobs/backtest-orchestrator.job';
import { BacktestWorkerMessage, runBacktestWorker } from './jobs/backtest-worker.job';
import { runPrediction } from './jobs/prediction.job';
import { runBacktestSummarizer } from './jobs/backtest-summarizer.job';
import { firestoreService } from './services/Firestore.service';

console.log('--- Démarrage du microservice football ---');

const app = express();
app.use(express.json());

app.use(cors());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Requête reçue : ${req.method} ${req.originalUrl}`);
    next();
});

const PORT = process.env.PORT || 8080;

// ====================================================================
// ROUTES DE L'APPLICATION
// ====================================================================

console.log("--- Début de l'enregistrement des routes ---");

app.get('/api/tickets', async (req, res) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
        console.log(`Recherche de tickets pour la date: ${date}`);
        const tickets = await firestoreService.getTicketsForDate(date);

        if (tickets.length > 0) {
            res.status(200).json({ success: true, data: tickets });
        } else {
            res.status(404).json({ success: false, message: `Aucun ticket trouvé pour la date ${date}` });
        }
    } catch (error) {
        console.error('Erreur sur /api/tickets:', error);
        res.status(500).json({ success: false, message: "Erreur interne du serveur lors de la récupération des tickets." });
    }
});
console.log("Preuve : Route GET /api/tickets enregistrée.");


app.get('/api/predictions', async (req, res) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
        console.log(`Recherche de prédictions pour la date: ${date}`);
        const predictions = await firestoreService.getPredictionsForDate(date);

        if (predictions.length > 0) {
            res.status(200).json({ success: true, data: predictions });
        } else {
            res.status(404).json({ success: false, message: `Aucune prédiction trouvée pour la date ${date}` });
        }
    } catch (error) {
        console.error('Erreur sur /api/predictions:', error);
        res.status(500).json({ success: false, message: "Erreur interne du serveur lors de la récupération des prédictions." });
    }
});
console.log("Preuve : Route GET /api/predictions enregistrée.");


app.get('/health', (req, res) => {
    console.log('Health Check demandé. Service en bonne santé.');
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});
console.log("Preuve : Route GET /health enregistrée.");


app.get('/run-daily-pipeline', async (req, res) => {
    console.log('--- Déclenchement manuel du pipeline de jobs quotidien ---');
    res.status(202).json({ message: 'Le pipeline a démarré en arrière-plan.' });

    try {
        await runBacktestOrchestrator();
        await runBacktestSummarizer();
        await runPrediction();
        await runTicketGenerator();
        await runResultsUpdater();
        await runPredictionCompleter();
        await runLeagueOrchestrator();
        console.log('--- Pipeline de jobs quotidien terminé avec succès ---');
    } catch (error) {
        console.error('Erreur critique lors de l\'exécution du pipeline :', error);
    }
});

app.post('/pubsub-backtest-worker', async (req, res) => {
    if (!req.body || !req.body.message) {
        console.error('Requête Pub/Sub invalide : corps ou message manquant.');
        return res.status(400).json({ error: 'Requête invalide' });
    }
    try {
        const messageData = Buffer.from(req.body.message.data, 'base64').toString('utf-8');
        const messagePayload = JSON.parse(messageData) as BacktestWorkerMessage;
        runBacktestWorker(messagePayload);
        res.status(204).send();
    } catch (error) {
        console.error('Erreur dans le worker Pub/Sub :', error);
        res.status(500).json({ error: 'Échec du traitement du message' });
    }
});

console.log("--- Fin de l'enregistrement des routes ---");

// ====================================================================
// GESTION DES ERREURS (DOIT ÊTRE À LA FIN)
// ====================================================================

app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route non trouvée: ${req.method} ${req.path}`
    });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('--- ERREUR SERVEUR NON GÉRÉE ---', err);
    res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Le microservice est démarré et écoute sur le port ${PORT}`);
});