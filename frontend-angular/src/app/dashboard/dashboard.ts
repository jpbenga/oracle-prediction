import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { DaySelector } from '../components/day-selector/day-selector';
import { Paywall } from '../components/paywall/paywall';
import { PredictionsList } from '../components/predictions-list/predictions-list';
import { TicketsList } from '../components/tickets-list/tickets-list';
import { ArchitectsSimulator } from '../components/architects-simulator/architects-simulator';
import { PredictionsApiResponse, TicketsApiResponse } from '../types/api-types';

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
  styleUrls: ['./dashboard.scss']
})
export class Dashboard implements OnInit {
  predictionsData: PredictionsApiResponse | null = null;
  ticketsData: TicketsApiResponse | null = null;
  isLoading = true;
  error: string | null = null;
  selectedDayOffset = 0;
  isPremium = false;
  showPaywall = false;

  authService = inject(AuthService);

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.isLoading = true;
    forkJoin({
      predictions: this.apiService.getPredictions(),
      tickets: this.apiService.getTickets()
    }).subscribe({
      next: (data) => {
        this.predictionsData = data.predictions;
        this.ticketsData = data.tickets;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = "Impossible de charger les données depuis Firestore. L'émulateur est-il bien démarré sur localhost:8080 ?";
        this.isLoading = false;
      }
    });
  }

  handleDaySelect(offset: number): void {
    if (!this.isPremium && offset > 0) {
      this.showPaywall = true;
      return;
    }
    this.selectedDayOffset = offset;
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