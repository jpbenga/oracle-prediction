import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private apiUrl = 'https://8080-firebase-oracle-1756386464926.cluster-64pjnskmlbaxowh5lzq6i7v4ra.cloudworkstations.dev/api/tickets';

  constructor(private http: HttpClient) { }

  getTickets(): Observable<any> {
    return this.http.get(this.apiUrl, { withCredentials: true });
  }
}