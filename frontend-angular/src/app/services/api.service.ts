import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'; // 1. Importez HttpClient
import { Observable } from 'rxjs';
import { PredictionsApiResponse, TicketsApiResponse } from '../types/api-types';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  // 2. Définissez l'URL de base de votre API déployée
  private baseUrl = 'https://oracle-prediction-gateway-43pysj5a.ew.gateway.dev/api';

  // 3. Injectez HttpClient dans le constructeur
  constructor(private http: HttpClient) { }

  /**
   * Récupère les tickets depuis votre API backend.
   */
  getTickets(date?: string): Observable<TicketsApiResponse> {
    const url = date ? `${this.baseUrl}/tickets?date=${date}` : `${this.baseUrl}/tickets`;
    return this.http.get<TicketsApiResponse>(url);
  }

  /**
   * Récupère les prédictions depuis votre API backend.
   */
  getPredictions(date?: string): Observable<PredictionsApiResponse> {
    const url = date ? `${this.baseUrl}/predictions?date=${date}` : `${this.baseUrl}/predictions`;
    return this.http.get<PredictionsApiResponse>(url);
  }
}