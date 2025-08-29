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
  @Input() tickets: any;
  @Input() selectedDayOffset: number = 0;
  objectKeys = Object.keys;

  getSelectedDayKey(): string {
    const date = new Date();
    date.setDate(date.getDate() + this.selectedDayOffset);
    return date.toLocaleDateString('fr-FR');
  }
}