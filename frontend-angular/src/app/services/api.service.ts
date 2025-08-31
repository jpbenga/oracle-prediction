import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { PredictionsApiResponse, TicketsApiResponse, Prediction, Ticket } from '../types/api-types';
import { Firestore, collection, collectionData, getDocs } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private firestore: Firestore) { }

  /**
   * Récupère les tickets depuis la collection Firestore 'tickets'.
   * Regroupe les tickets par date de création.
   */
  getTickets(): Observable<TicketsApiResponse> {
    const ticketsCollection = collection(this.firestore, 'tickets');
    return (collectionData(ticketsCollection, { idField: 'id' }) as Observable<Ticket[]>).pipe(
      map(tickets => {
        const groupedByDate: TicketsApiResponse = {};
        tickets.forEach(ticket => {
          // Assumons que les tickets ont un champ 'date' ou 'creation_date'
          // Pour l'exemple, nous utilisons une date statique si non disponible
          const date = (ticket as any).date || new Date().toLocaleDateString('fr-FR');
          if (!groupedByDate[date]) {
            groupedByDate[date] = { Prudent: [], Equilibre: [], Audacieux: [] };
          }
          if (groupedByDate[date][ticket.profile]) {
            groupedByDate[date][ticket.profile]!.push(ticket);
          }
        });
        return groupedByDate;
      })
    );
  }

  /**
   * Récupère les prédictions depuis la collection Firestore 'predictions'.
   * Regroupe les prédictions par nom de ligue.
   */
  getPredictions(): Observable<PredictionsApiResponse> {
    const predictionsCollection = collection(this.firestore, 'predictions');
    return (collectionData(predictionsCollection, { idField: 'id' }) as Observable<Prediction[]>).pipe(
      map(predictions => {
        const groupedByLeague: PredictionsApiResponse = {};
        predictions.forEach(prediction => {
          const league = prediction.leagueName;
          if (!groupedByLeague[league]) {
            groupedByLeague[league] = [];
          }
          groupedByLeague[league].push(prediction);
        });
        return groupedByLeague;
      })
    );
  }
}
