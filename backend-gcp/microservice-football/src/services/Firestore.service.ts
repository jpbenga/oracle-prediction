const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const chalk = require('chalk');

if (!admin.apps.length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        // Emulator is running, no credentials needed
        initializeApp();
    } else {
        // Production environment, use service account
        try {
            const serviceAccount = require(path.resolve(__dirname, '../../../../firebase-service-account.json'));
            initializeApp({
                credential: cert(serviceAccount)
            });
        } catch (e) {
            console.error('Could not load service account. Make sure the file is present. Falling back to default credentials.', e);
            initializeApp(); // Fallback for other GCP environments
        }
    }
}

const db = getFirestore();

const firestoreService = {
    async getLeagueStatus(leagueId: any) {
        const docRef = db.collection('leagues_status').doc(leagueId);
        const doc = await docRef.get();
        return doc.exists ? doc.data() : null;
    },

    async updateLeagueStatus(leagueId: any, data: any) {
        const docRef = db.collection('leagues_status').doc(leagueId);
        await docRef.set(data, { merge: true });
    },

    async getAllLeaguesStatus() {
        const snapshot = await db.collection('leagues_status').get();
        return snapshot.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() }));
    },

    async getIncompletePredictions() {
        const snapshot = await db.collection('predictions').where('status', '==', 'INCOMPLETE').get();
        return snapshot.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() }));
    },

    async updatePrediction(predictionId: any, data: any) {
        const docRef = db.collection('predictions').doc(predictionId);
        await docRef.set(data, { merge: true });
    },

    async savePrediction(predictionData: any) {
        console.log(chalk.blue('      [Firestore Service] Tentative de sauvegarde de la prédiction:'), predictionData.matchLabel);
        try {
            const docRef = db.collection('predictions').doc();
            await docRef.set(predictionData);
            console.log(chalk.green.bold(`      [Firestore Service] SUCCÈS: Prédiction ${docRef.id} sauvegardée.`));
            return docRef.id;
        } catch (error) {
            console.error(chalk.red.bold('      [Firestore Service] ERREUR lors de la sauvegarde:'), error);
            return null;
        }
    },

    async deleteTicketsForDate(date: any) {
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
        snapshot.docs.forEach((doc: { ref: any; }) => batch.delete(doc.ref));
        await batch.commit();
    },

    async getEligiblePredictions(date: any) {
        let query = db.collection('predictions').where('status', '==', 'ELIGIBLE');
        if (date) {
            query = query.where('matchDate', '>=', `${date}T00:00:00Z`).where('matchDate', '<=', `${date}T23:59:59Z`);
        }
        const snapshot = await query.get();
        return snapshot.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() }));
    },

    async getPendingPredictions() {
        const now = new Date().toISOString();
        const snapshot = await db.collection('predictions')
            .where('status', '==', 'PENDING')
            .where('matchDate', '<', now)
            .get();
        return snapshot.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() }));
    },

    async getPendingTickets() {
        const snapshot = await db.collection('tickets').where('status', '==', 'PENDING').get();
        return snapshot.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() }));
    },

    async updateTicket(ticketId: any, data: any) {
        const docRef = db.collection('tickets').doc(ticketId);
        await docRef.set(data, { merge: true });
    }
};

module.exports = { firestoreService };