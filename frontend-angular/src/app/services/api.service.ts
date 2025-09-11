import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Prediction, Ticket } from '../types/api-types';
import { collection, query, where, onSnapshot, Firestore } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private firestore: Firestore = inject(Firestore);

  getTickets(date: string): Observable<Ticket[]> {
    const ticketsCollection = collection(this.firestore, 'tickets');
    const q = query(ticketsCollection, where("creation_date", "==", date));

    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const tickets: Ticket[] = [];
        querySnapshot.forEach((doc) => {
          tickets.push({ id: doc.id, ...doc.data() } as Ticket);
        });
        observer.next(tickets);
      });
      return () => unsubscribe();
    });
  }

  getPredictions(date: string): Observable<Prediction[]> {
    const predictionsCollection = collection(this.firestore, 'predictions');
    const q = query(predictionsCollection, where("matchDate", ">=", date + "T00:00:00.000Z"), where("matchDate", "<=", date + "T23:59:59.999Z"));

    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const predictions: Prediction[] = [];
        querySnapshot.forEach((doc) => {
          predictions.push({ id: doc.id, ...doc.data() } as Prediction);
        });
        observer.next(predictions);
      });
      return () => unsubscribe();
    });
  }
}