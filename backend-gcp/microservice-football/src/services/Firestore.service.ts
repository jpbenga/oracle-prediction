import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import chalk from 'chalk';

if (!admin.apps.length) {
    if (process.env.GCP_PROJECT || process.env.K_SERVICE) {
        console.log(chalk.green('      [Firestore] Initialisation avec les identifiants Google Cloud par défaut.'));
        initializeApp();
    }
    else if (process.env.FIRESTORE_EMULATOR_HOST) {
        console.log(chalk.yellow('      [Firestore] Connexion à l\'émulateur:', process.env.FIRESTORE_EMULATOR_HOST));
        initializeApp();
    }
    else {
        try {
            console.log(chalk.blue('      [Firestore] Initialisation avec le fichier de compte de service local.'));
            const serviceAccount = require(path.resolve(__dirname, '../../../../firebase-service-account.json'));
            initializeApp({
                credential: cert(serviceAccount)
            });
        } catch (e) {
            console.error(chalk.red.bold('      [Firestore] ERREUR CRITIQUE: Impossible de charger le fichier firebase-service-account.json pour le développement local.'));
            process.exit(1);
        }
    }
}

const db = getFirestore();

export const firestoreService = {
    async testConnection(): Promise<boolean> {
        try {
            console.log(chalk.blue('      [Firestore] Test de connexion...'));
            await db.collection('_test').doc('connection').get();
            console.log(chalk.green('      [Firestore] Connexion OK'));
            return true;
        } catch (error) {
            if (error instanceof Error) {
                console.error(chalk.red('      [Firestore] Erreur de connexion:'), error.message);
            } else {
                console.error(chalk.red('      [Firestore] Erreur de connexion:'), error);
            }
            return false;
        }
    },

    async getLeagueStatus(leagueId: string): Promise<admin.firestore.DocumentData | null> {
        const docRef = db.collection('leagues_status').doc(leagueId);
        const doc = await docRef.get();
        return doc.exists ? doc.data()! : null;
    },

    async updateLeagueStatus(leagueId: string, data: any): Promise<void> {
        const docRef = db.collection('leagues_status').doc(leagueId);
        await docRef.set(data, { merge: true });
    },

    async getAllLeaguesStatus(): Promise<any[]> {
        const snapshot = await db.collection('leagues_status').get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async getIncompletePredictions(): Promise<any[]> {
        const snapshot = await db.collection('predictions').where('status', '==', 'INCOMPLETE').get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async updatePrediction(predictionId: string, data: any): Promise<void> {
        const docRef = db.collection('predictions').doc(predictionId);
        await docRef.set(data, { merge: true });
    },

    async savePrediction(predictionData: { matchLabel: any; }): Promise<string | null> {
        console.log(chalk.blue('      [Firestore Service] Tentative de sauvegarde de la prédiction:'), predictionData.matchLabel);
        
        const isConnected = await this.testConnection();
        if (!isConnected) {
            console.error(chalk.red('      [Firestore Service] Impossible de se connecter à Firestore'));
            return null;
        }
        
        try {
            console.log(chalk.gray('      [Firestore Service] Création de la référence document...'));
            const docRef = db.collection('predictions').doc();
            console.log(chalk.gray('      [Firestore Service] Document ID:'), docRef.id);
            
            const savePromise = docRef.set(predictionData);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout de 5 secondes atteint')), 5000)
            );
            
            await Promise.race([savePromise, timeoutPromise]);
            
            console.log(chalk.green.bold(`      [Firestore Service] SUCCÈS: Prédiction ${docRef.id} sauvegardée.`));
            return docRef.id;
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('Timeout')) {
                    console.error(chalk.red.bold('      [Firestore Service] TIMEOUT: L\'émulateur Firestore ne répond pas'));
                    console.error(chalk.red.bold('      [Firestore Service] Vérifiez que l\'émulateur est démarré sur localhost:8080'));
                } else {
                    console.error(chalk.red.bold('      [Firestore Service] ERREUR lors de la sauvegarde:'), error.message);
                }
            } else {
                 console.error(chalk.red.bold('      [Firestore Service] ERREUR lors de la sauvegarde:'), error);
            }
            return null;
        }
    },

    async saveBacktest(backtestData: { matchLabel: any; }): Promise<string | null> {
        console.log(chalk.blue('      [Firestore Service] Tentative de sauvegarde du résultat de backtest:'), backtestData.matchLabel);
        try {
            const docRef = db.collection('backtests').doc();
            await docRef.set(backtestData);
            console.log(chalk.green.bold(`      [Firestore Service] SUCCÈS: Backtest ${docRef.id} sauvegardé.`));
            return docRef.id;
        } catch (error) {
            if (error instanceof Error) {
                console.error(chalk.red.bold('      [Firestore Service] ERREUR lors de la sauvegarde du backtest:'), error.message);
            } else {
                console.error(chalk.red.bold('      [Firestore Service] ERREUR lors de la sauvegarde du backtest:'), error);
            }
            return null;
        }
    },

    async deleteTicketsForDate(date: string): Promise<void> {
        const startDate = new Date(`${date}T00:00:00.000Z`);
        const endDate = new Date(`${date}T23:59:59.999Z`);

        const snapshot = await db.collection('tickets')
            .where('creation_date', '>=', startDate)
            .where('creation_date', '<=', endDate)
            .where('status', '==', 'PENDING')
            .get();

        if (snapshot.empty) {
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    },

    async getEligiblePredictions(date: string): Promise<any[]> {
        let query: admin.firestore.Query = db.collection('predictions').where('status', '==', 'ELIGIBLE');
        if (date) {
            query = query.where('matchDate', '>=', `${date}T00:00:00Z`).where('matchDate', '<=', `${date}T23:59:59Z`);
        }
        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async getPredictionsForDate(date: string): Promise<any[]> {
        let query: admin.firestore.Query = db.collection('predictions');
        if (date) {
            query = query.where('matchDate', '>=', `${date}T00:00:00Z`).where('matchDate', '<=', `${date}T23:59:59Z`);
        }
        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async getTicketsForDate(date: string): Promise<any[]> {
        const startDate = new Date(`${date}T00:00:00.000Z`);
        const endDate = new Date(`${date}T23:59:59.999Z`);

        const snapshot = await db.collection('tickets')
            .where('creation_date', '>=', startDate)
            .where('creation_date', '<=', endDate)
            .get();
            
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async getPendingPredictions(): Promise<any[]> {
        const now = new Date().toISOString();
        const snapshot = await db.collection('predictions')
            .where('status', '==', 'PENDING')
            .where('matchDate', '<', now)
            .get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async getPendingTickets(): Promise<any[]> {
        const snapshot = await db.collection('tickets').where('status', '==', 'PENDING').get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async updateTicket(ticketId: string, data: any): Promise<void> {
        const docRef = db.collection('tickets').doc(ticketId);
        await docRef.set(data, { merge: true });
    },

    async closeConnection(): Promise<void> {
        try {
            console.log(chalk.yellow('      [Firestore] Fermeture de la connexion...'));
            await admin.app().delete();
            console.log(chalk.green('      [Firestore] Connexion fermée.'));
        } catch (error) {
            if (error instanceof Error) {
                console.error(chalk.red('      [Firestore] Erreur lors de la fermeture de la connexion:'), error.message);
            } else {
                console.error(chalk.red('      [Firestore] Erreur lors de la fermeture de la connexion:'), error);
            }
        }
    }
};

module.exports = { firestoreService };
