import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PredictionsApiResponse } from '../types/api-types';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) { }

  getTickets(): Observable<any> {
    // Assuming a similar structure for tickets, but leaving as 'any' for now
    return this.http.get(`${this.baseUrl}/tickets`, { withCredentials: true });
  }

  getPredictions(): Observable<PredictionsApiResponse> {
    return this.http.get<PredictionsApiResponse>(`${this.baseUrl}/predictions`, { withCredentials: true });
  }
}
