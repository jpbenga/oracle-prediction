import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { DaySelector } from '../components/day-selector/day-selector';
import { Paywall } from '../components/paywall/paywall';
import { PredictionsList } from '../components/predictions-list/predictions-list';
import { TicketsList } from '../components/tickets-list/tickets-list';
import { ArchitectsSimulator } from '../components/architects-simulator/architects-simulator';
import { EmptyStateComponent } from '../components/empty-state/empty-state.component';
import { PredictionsApiResponse, TicketsApiResponse } from '../types/api-types';
import { catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    DaySelector,
    Paywall,
    PredictionsList,
    TicketsList,
    ArchitectsSimulator,
    EmptyStateComponent
  ],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  predictionsData: PredictionsApiResponse = {};
  ticketsData: TicketsApiResponse = {};
  isLoading = true;
  error: { title: string, message: string } | null = null;
  selectedDayOffset = 0;
  isPremium = false;
  showPaywall = false;

  authService = inject(AuthService);
  apiService = inject(ApiService);
  objectKeys = Object.keys;

  ngOnInit(): void {
    const date = this.getDateFromOffset(0);
    this.loadDataForDate(date);
  }

  loadDataForDate(date: string): void {
    this.isLoading = true;
    this.error = null;
    this.predictionsData = {};
    this.ticketsData = {};

    this.apiService.getPredictions(date).pipe(
      catchError(err => {
        if (err.status !== 404) {
          console.error("Erreur API (Prédictions):", err);
          this.error = {
            title: 'Anomalie dans la Matrice',
            message: 'Le flux de données des prédictions a été corrompu. Impossible de contacter la Source.'
          };
        }
        return of({});
      })
    ).subscribe(data => {
      this.predictionsData = data;
    });

    this.apiService.getTickets(date).pipe(
      catchError(err => {
        if (err.status !== 404) {
          console.error("Erreur API (Tickets):", err);
          if (!this.error) { // Display the first error that occurs
            this.error = {
              title: 'Signal Interrompu',
              message: 'Impossible de matérialiser les tickets. Le signal vers le Mainframe est perdu.'
            };
          }
        }
        return of({});
      }),
      tap(() => {
        if (this.error) { // If an error occurred, stop loading
          this.isLoading = false;
        }
      })
    ).subscribe(data => {
      this.ticketsData = data;
      this.isLoading = false; // Also stop loading on success
    });
  }
  
  handleDaySelect(offset: number): void {
    this.selectedDayOffset = offset;
    const date = this.getDateFromOffset(offset);
    this.loadDataForDate(date);
  }

  getDateFromOffset(offset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().split('T')[0];
  }

  closePaywall(): void {
    this.showPaywall = false;
  }

  handleActivatePremium(): void {
    this.isPremium = true;
    this.showPaywall = false;
  }

  togglePremium(): void {
    this.isPremium = !this.isPremium;
  }
}