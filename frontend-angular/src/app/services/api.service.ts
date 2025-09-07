import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Prediction, Ticket } from '../types/api-types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = 'https://config-finale-1-43pysj5a.ew.gateway.dev'

  constructor(private http: HttpClient) { }

  getTickets(date: string): Observable<Ticket[]> {
    const url = `${this.baseUrl}/api/tickets?date=${date}`;
    return this.http.get<ApiResponse<Ticket[]>>(url).pipe(
      map(response => (response.success && response.data) ? response.data : []),
      catchError(this.handleError<Ticket[]>('getTickets', []))
    );
  }

  getPredictions(date: string): Observable<Prediction[]> {
    const url = `${this.baseUrl}/api/predictions?date=${date}`;
    return this.http.get<ApiResponse<Prediction[]>>(url).pipe(
      map(response => (response.success && response.data) ? response.data : []),
      catchError(this.handleError<Prediction[]>('getPredictions', []))
    );
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`Erreur dans ${operation}:`, error);
      return of(result as T);
    };
  }
}