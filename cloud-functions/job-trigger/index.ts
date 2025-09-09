import express from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { firestoreService } from '../../backend-gcp/microservice-football/src/services/Firestore.service';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get('/api/predictions', async (req, res) => {
    try {
        const date = req.query.date as string;
        if (!date) {
            return res.status(400).send('Le paramètre de date est manquant.');
        }
        const predictions = await firestoreService.getPredictionsByDate(date);
        res.status(200).json(predictions);
    } catch (error) {
        console.error("Erreur lors de la récupération des prédictions", error);
        res.status(500).send("Erreur interne du serveur.");
    }
});

app.get('/api/tickets', async (req, res) => {
    try {
        const date = req.query.date as string;
        if (!date) {
            return res.status(400).send('Le paramètre de date est manquant.');
        }
        const tickets = await firestoreService.getTicketsByDate(date);
        res.status(200).json(tickets);
    } catch (error) {
        console.error("Erreur lors de la récupération des tickets", error);
        res.status(500).send("Erreur interne du serveur.");
    }
});

app.listen(PORT, () => {
    console.log(chalk.green.bold(`--- Serveur API démarré sur le port ${PORT} ---`));
});