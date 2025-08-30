import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketCard } from '../ticket-card/ticket-card';

@Component({
  selector: 'app-tickets-list',
  standalone: true,
  imports: [CommonModule, TicketCard],
  templateUrl: './tickets-list.html',
  styleUrls: ['./tickets-list.scss']
})
export class TicketsList {
  @Input() ticketsData: any;
  @Input() selectedDayOffset: number = 0;
  
  // Expose Object.keys to the template
  objectKeys = Object.keys;

  getSelectedDayKey(): string {
    const date = new Date();
    date.setDate(date.getDate() + this.selectedDayOffset);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}