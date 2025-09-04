import { Firestore, DocumentData } from '@google-cloud/firestore';
import chalk from 'chalk';
import { BacktestResult, BacktestBilan } from '../types/football.types';

class FirestoreService {
  private db: Firestore;
  private readonly BACKTEST_SUMMARY_DOC_PATH = 'system_reports/backtest_summary';

  constructor() {
    this.db = new Firestore();
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.db.listCollections();
      console.log(chalk.green('[Firestore Service] Connexion à Firestore réussie.'));
      return true;
    } catch (error) {
      console.error(chalk.red('[Firestore Service] Échec de la connexion à Firestore :'), error);
      return false;
    }
  }

  // ... [Méthodes existantes pour league_status, predictions, tickets]
  public async getLeagueStatus(leagueId: string): Promise<DocumentData | null> {
    const docRef = this.db.collection('leagues_status').doc(String(leagueId));
    const doc = await docRef.get();
    return doc.exists ? (doc.data() as DocumentData) : null;
  }

  public async updateLeagueStatus(leagueId: string, data: any): Promise<void> {
    const docRef = this.db.collection('leagues_status').doc(String(leagueId));
    await docRef.set(data, { merge: true });
  }

  public async savePrediction(prediction: any): Promise<string> {
    const docRef = await this.db.collection('predictions').add(prediction);
    return docRef.id;
  }
    
  public async findIncompletePredictions(): Promise<DocumentData[]> {
    const snapshot = await this.db.collection('predictions').where('status', '==', 'INCOMPLETE').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  public async updatePrediction(predictionId: string, data: any): Promise<void> {
    await this.db.collection('predictions').doc(predictionId).update(data);
  }

  public async deletePendingTicketsForDate(date: string): Promise<void> {
    const snapshot = await this.db.collection('tickets')
      .where('status', '==', 'PENDING')
      .where('creation_date', '==', date)
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  public async getEligiblePredictionsForDate(date: string): Promise<DocumentData[]> {
      const snapshot = await this.db.collection('predictions')
        .where('status', '==', 'ELIGIBLE')
        .where('matchDate', '>=', `${date}T00:00:00Z`)
        .where('matchDate', '<=', `${date}T23:59:59Z`)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  
  public async saveTicket(ticket: any): Promise<void> {
      await this.db.collection('tickets').add(ticket);
  }

  public async getPendingItems(): Promise<{ predictions: DocumentData[], tickets: DocumentData[] }> {
    const now = new Date().toISOString();

    const predictionsSnapshot = await this.db.collection('predictions')
      .where('status', '==', 'PENDING')
      .where('matchDate', '<', now)
      .get();

    const ticketsSnapshot = await this.db.collection('tickets')
      .where('status', '==', 'PENDING')
      .get();
      
    return {
      predictions: predictionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      tickets: ticketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
  }
  
  public async updateTicketStatus(ticketId: string, status: 'WON' | 'LOST'): Promise<void> {
      await this.db.collection('tickets').doc(ticketId).update({ status });
  }


  // ====================================================================
  // MÉTHODES POUR LE BACKTESTING
  // ====================================================================

  public async saveBacktestResult(result: BacktestResult): Promise<string> {
    const docRef = await this.db.collection('backtest_results').add(result);
    return docRef.id;
  }

  public async getAllBacktestResults(): Promise<BacktestResult[]> {
    const snapshot = await this.db.collection('backtest_results').get();
    // On ne retourne que les documents qui ont un champ 'markets' de type tableau.
    // Cela élimine les documents malformés ou d'un autre type.
    return snapshot.docs
        .map(doc => doc.data() as BacktestResult)
        .filter(doc => doc && Array.isArray(doc.markets));
  }

  public async saveBacktestSummary(summary: BacktestBilan): Promise<void> {
    const docRef = this.db.doc(this.BACKTEST_SUMMARY_DOC_PATH);
    await docRef.set(summary);
  }

  public async getBacktestSummary(): Promise<BacktestBilan | null> {
    const docRef = this.db.doc(this.BACKTEST_SUMMARY_DOC_PATH);
    const doc = await docRef.get();
    return doc.exists ? (doc.data() as BacktestBilan) : null;
  }

  // ====================================================================
  // MÉTHODES POUR L'API (si nécessaire)
  // ====================================================================
  public async getTicketsForDate(date: string): Promise<DocumentData[]> {
    const snapshot = await this.db.collection('tickets')
      .where('creation_date', '==', date)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  public async getPredictionsForDate(date: string): Promise<DocumentData[]> {
    const startDate = `${date}T00:00:00Z`;
    const endDate = `${date}T23:59:59Z`;
    const snapshot = await this.db.collection('predictions')
      .where('matchDate', '>=', startDate)
      .where('matchDate', '<=', endDate)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  public async closeConnection(): Promise<void> {
    await this.db.terminate();
  }
}

export const firestoreService = new FirestoreService();
