const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const { runBacktest } = require('./jobs/backtest.job');
const { runPrediction } = require('./jobs/prediction.job');
const { runTicketGenerator } = require('./jobs/ticket-generator.job');

const app = express();
const PORT = process.env.PORT || 8080;

// --- CONFIGURATION CORS SPÉCIFIQUE ---
const corsOptions = {
    origin: 'http://localhost:4200', // Autoriser le frontend local
    credentials: true, // Autoriser les cookies et les en-têtes d'authentification
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));


// --- ROUTE POUR TOUT ENCHAÎNER ---
app.get('/run-all-jobs', (req: any, res: any) => {
    res.status(202).json({ message: "La chaîne de jobs complète a été démarrée." });
    const runFullSequence = async () => {
        try {
            await runBacktest();
            await runPrediction();
            runTicketGenerator();
        } catch (error) {
            console.error(chalk.red.bold("ERREUR CRITIQUE DANS LA SÉQUENCE DE JOBS :"), error);
        }
    };
    runFullSequence();
});


// --- ROUTE API POUR LE FRONTEND ---
app.get('/api/tickets', (req: any, res: any) => {
    try {
        const filePath = path.join(__dirname, '..', 'tickets_du_jour.json');
        const data = fs.readFileSync(filePath, 'utf8');
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        res.status(404).json({ message: "Le fichier de tickets n'a pas encore été généré." });
    }
});

// --- NOUVELLE ROUTE API POUR LES PRÉDICTIONS BRUTES ---
app.get('/api/predictions', (req: any, res: any) => {
    try {
        const filePath = path.join(__dirname, '..', 'predictions_du_jour.json');
        const data = fs.readFileSync(filePath, 'utf8');
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        res.status(404).json({ message: "Le fichier de prédictions n'a pas encore été généré." });
    }
});


app.listen(PORT, () => {
    console.log(chalk.inverse(`\n🏈 Microservice Football démarré sur le port ${PORT}`));
    console.log(chalk.cyan(`   API disponible sur http://localhost:${PORT}/api/tickets`));
    console.log(chalk.magenta.bold(`   Pour tout lancer, visitez http://localhost:${PORT}/run-all-jobs`));
});