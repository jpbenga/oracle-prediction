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
import { PredictionsApiResponse, TicketsApiResponse } from '../types/api-types';
import { catchError } from 'rxjs/operators';
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
    ArchitectsSimulator
  ],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  predictionsData: PredictionsApiResponse = {};
  ticketsData: TicketsApiResponse = {};
  isLoading = true;
  error: string | null = null;
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
        if (err.status !== 404) { this.error = 'Erreur chargement prédictions.'; }
        return of({});
      })
    ).subscribe(data => {
      this.predictionsData = data;
    });

    this.apiService.getTickets(date).pipe(
      catchError(err => {
        if (err.status !== 404) { this.error = 'Erreur chargement tickets.'; }
        return of({});
      })
    ).subscribe(data => {
      this.ticketsData = data;
      this.isLoading = false;
    });
  }
  
  handleDaySelect(offset: number): void {
    if (!this.isPremium && offset > 0) {
      this.showPaywall = true;
      return;
    }
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