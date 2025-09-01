
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketCard } from '../ticket-card/ticket-card';
import { TicketsApiResponse } from '../../types/api-types';

@Component({
  selector: 'app-tickets-list',
  standalone: true,
  imports: [CommonModule, TicketCard],
  templateUrl: './tickets-list.html',
  styleUrls: ['./tickets-list.scss']
})
export class TicketsList {
  @Input() ticketsData: TicketsApiResponse | null = null;
  @Input() selectedDayOffset: number = 0;
  
  objectKeys = Object.keys;

  get selectedDayKey(): string {
    const date = new Date();
    date.setDate(date.getDate() + this.selectedDayOffset);
    return date.toLocaleDateString('fr-FR');
  }

  get ticketsForSelectedDay() {
    if (!this.ticketsData) {
      return null;
    }
    return this.ticketsData[this.selectedDayKey];
  }

  get oraclesChoice() {
    const tickets = this.ticketsForSelectedDay;
    return tickets && tickets["The Oracle's Choice"] ? tickets["The Oracle's Choice"][0] : null;
  }

  get otherTickets() {
    const tickets = this.ticketsForSelectedDay;
    if (!tickets) {
      return [];
    }
    const otherTickets = [];
    if (tickets["The Agent's Play"]) {
      otherTickets.push(...tickets["The Agent's Play"]);
    }
    if (tickets["The Red Pill"]) {
      otherTickets.push(...tickets["The Red Pill"]);
    }
    return otherTickets;
  }
}
