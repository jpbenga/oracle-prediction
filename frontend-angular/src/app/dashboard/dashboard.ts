import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketService } from '../services/ticket';
import { TicketsList } from '../components/tickets-list/tickets-list';

// Importer les modules Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    TicketsList,
    MatToolbarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class Dashboard implements OnInit {
  ticketsData: any = null;
  isLoading = true;
  error: string | null = null;

  constructor(private ticketService: TicketService) {}

  ngOnInit(): void {
    this.ticketService.getTickets().subscribe({
      next: (data) => {
        this.ticketsData = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = "Impossible de charger les tickets. Le backend est-il démarré et les jobs ont-ils été exécutés ?";
        this.isLoading = false;
      }
    });
  }
}