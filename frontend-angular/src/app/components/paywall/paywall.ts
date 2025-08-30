import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-paywall',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paywall.html',
  styleUrls: ['./paywall.scss']
})
export class Paywall {
  @Output() close = new EventEmitter<void>();
  @Output() activatePremium = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onActivate(): void {
    this.activatePremium.emit();
  }
}
