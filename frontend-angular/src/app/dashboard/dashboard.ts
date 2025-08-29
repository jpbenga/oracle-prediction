import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketService } from '../services/ticket';
import { TicketsList } from '../components/tickets-list/tickets-list';
import { DaySelector } from '../components/day-selector/day-selector';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    TicketsList,
    DaySelector
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class Dashboard implements OnInit {
  ticketsData: any = null;
  isLoading = true;
  error: string | null = null;
  selectedDayOffset = 0;
  isPremium = false;

  constructor(private ticketService: TicketService) {}

  ngOnInit(): void {
    this.ticketService.getTickets().subscribe({
      next: (data) => {
        if (data && Object.keys(data).length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayKey = today.toLocaleDateString('fr-FR');

          const hasTicketsForToday = data[todayKey] && 
            (data[todayKey].Prudent.length > 0 || 
             data[todayKey].Equilibre.length > 0 || 
             data[todayKey].Audacieux.length > 0);

          if (!hasTicketsForToday) {
            const firstDayWithTickets = Object.keys(data).find(day => 
              data[day].Prudent.length > 0 || 
              data[day].Equilibre.length > 0 || 
              data[day].Audacieux.length > 0
            );

            if (firstDayWithTickets) {
              const [day, month, year] = firstDayWithTickets.split('/');
              const ticketDate = new Date(`${year}-${month}-${day}`);
              ticketDate.setHours(0, 0, 0, 0);
              const diffTime = ticketDate.getTime() - today.getTime();
              this.selectedDayOffset = Math.round(diffTime / (1000 * 60 * 60 * 24));
            }
          }
        }
        this.ticketsData = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = "Impossible de charger les tickets. Le backend est-il démarré et les jobs ont-ils été exécutés ?";
        this.isLoading = false;
      }
    });
  }

  handleDaySelect(offset: number): void {
    if (!this.isPremium && offset > 0) {
      console.log('Paywall should be shown for future dates.');
      return;
    }
    this.selectedDayOffset = offset;
  }

  togglePremium(): void {
    this.isPremium = !this.isPremium;
  }
}