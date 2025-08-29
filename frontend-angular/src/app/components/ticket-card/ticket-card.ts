import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Importer les modules Material nécessaires
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-ticket-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatDividerModule],
  templateUrl: './ticket-card.html',
  styleUrls: ['./ticket-card.scss']
})
export class TicketCard {
  @Input() ticket: any;
}