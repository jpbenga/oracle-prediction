import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Define a simple type for a bet, based on the fixture data
export interface Bet {
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  country: string;
  market: string;
  odd: number;
  score: number;
}

// Define the type for a ticket
export interface Ticket {
  totalOdd: number;
  bets: Bet[];
}

@Component({
  selector: 'app-ticket-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket-card.html',
  styleUrls: ['./ticket-card.scss']
})
export class TicketCard {
  @Input() ticket!: Ticket;
}