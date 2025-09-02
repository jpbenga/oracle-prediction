import express, { type Request, type Response } from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { firestoreService } from './services/Firestore.service';

import { runBacktest } from './jobs/backtest.job';
import { runPrediction } from './jobs/prediction.job';
import { runTicketGenerator } from './jobs/ticket-generator.job';

const app = express();
const PORT = process.env.PORT || 8080;

// --- CONFIGURATION CORS SPÉCIFIQUE ---
const allowedOrigins = [process.env.CORS_ORIGIN || 'http://localhost:4200'];
const corsOptions: cors.CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// --- MIDDLEWARE D'AUTHENTIFICATION (PLACEHOLDER) ---
const authenticate = (req: Request, res: Response, next: () => void) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ message: "Accès non autorisé. Jeton manquant." });
    }
    console.log(chalk.yellow("Authentification (placeholder) : Jeton reçu. Passage autorisé."));
    next();
};

// --- ROUTE POUR TOUT ENCHAÎNER (SÉCURISÉE) ---
app.get('/run-all-jobs', authenticate, (req: Request, res: Response) => {
    res.status(202).json({ message: "La chaîne de jobs complète a été démarrée." });
    const runFullSequence = async () => {
        try {
            await runBacktest();
            await runPrediction({});
            await runTicketGenerator({});
        } catch (error) {
            console.error(chalk.red.bold("ERREUR CRITIQUE DANS LA SÉQUENCE DE JOBS :"), error);
        }
    };
    runFullSequence();
});

// --- ROUTES API DYNAMIQUES POUR LE FRONTEND ---
app.get('/api/tickets', async (req: Request, res: Response) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
        if(date) {
            const tickets = await firestoreService.getTicketsForDate(date);
            if (tickets.length > 0) {
                res.status(200).json(tickets);
            } else {
                res.status(404).json({ message: "Aucun ticket trouvé pour cette date." });
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: "Erreur du serveur lors de la récupération des tickets.", error: error.message });
        } else {
            res.status(500).json({ message: "Erreur du serveur lors de la récupération des tickets." });
        }
    }
});

app.get('/api/predictions', async (req: Request, res: Response) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
        if(date) {
            const predictions = await firestoreService.getPredictionsForDate(date);
            if (predictions.length > 0) {
                res.status(200).json(predictions);
            } else {
                res.status(404).json({ message: "Aucune prédiction trouvée pour cette date." });
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: "Erreur du serveur lors de la récupération des prédictions.", error: error.message });
        } else {
            res.status(500).json({ message: "Erreur du serveur lors de la récupération des prédictions." });
        }
    }
});

app.listen(PORT, () => {
    console.log(chalk.inverse(`
🏈 Microservice Football démarré sur le port ${PORT}`));
    console.log(chalk.cyan(`   API dynamique sur http://localhost:${PORT}/api/tickets`));
    console.log(chalk.magenta.bold(`   Endpoint sécurisé sur http://localhost:${PORT}/run-all-jobs`));
});
