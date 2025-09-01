

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
const allowedOrigins = [process.env.CORS_ORIGIN || 'http://localhost:4200'];
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// --- MIDDLEWARE D'AUTHENTIFICATION (PLACEHOLDER) ---
const authenticate = (req, res, next) => {
    // Ceci est un placeholder. Remplacez-le par une vraie validation de jeton JWT.
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ message: "Accès non autorisé. Jeton manquant." });
    }

    // À l'avenir, vous valideriez le jeton ici avec Firebase Admin SDK.
    // admin.auth().verifyIdToken(token.split(' ')[1])
    //   .then(decodedToken => {
    //     req.user = decodedToken;
    //     next();
    //   })
    //   .catch(error => {
    //     res.status(403).json({ message: "Jeton invalide." });
    //   });

    console.log(chalk.yellow("Authentification (placeholder) : Jeton reçu. Passage autorisé."));
    next();
};


// --- ROUTE POUR TOUT ENCHAÎNER (SÉCURISÉE) ---
app.get('/run-all-jobs', authenticate, (req, res) => {
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


// --- ROUTES API PUBLIQUES POUR LE FRONTEND ---
app.get('/api/tickets', (req, res) => {
    try {
        const filePath = path.join(__dirname, '..', 'tickets_du_jour.json');
        const data = fs.readFileSync(filePath, 'utf8');
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        res.status(404).json({ message: "Le fichier de tickets n'a pas encore été généré." });
    }
});

app.get('/api/predictions', (req, res) => {
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
    console.log(chalk.cyan(`   API publique sur http://localhost:${PORT}/api/tickets`));
    console.log(chalk.magenta.bold(`   Endpoint sécurisé sur http://localhost:${PORT}/run-all-jobs`));
});
