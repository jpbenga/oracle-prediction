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
        this.ticketsData = this.filterTicketsByDay(data, this.selectedDayOffset);
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
      // In a real app, you would show a paywall.
      // For now, we'll just log a message.
      console.log('Paywall should be shown for future dates.');
      return;
    }
    this.selectedDayOffset = offset;
    // Here you would typically refetch the data for the selected day.
    // For this example, we'll filter the existing data.
    this.ticketService.getTickets().subscribe(data => {
      this.ticketsData = this.filterTicketsByDay(data, this.selectedDayOffset);
    });
  }

  togglePremium(): void {
    this.isPremium = !this.isPremium;
  }

  private filterTicketsByDay(data: any, offset: number): any {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + offset);
    const targetDateString = targetDate.toISOString().split('T')[0];

    if (data && data[targetDateString]) {
      return { [targetDateString]: data[targetDateString] };
    }
    return {};
  }
}