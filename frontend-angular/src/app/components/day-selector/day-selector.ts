import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-day-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './day-selector.html',
  styleUrls: ['./day-selector.scss']
})
export class DaySelector {
  @Input() selectedDayOffset: number = 0;
  @Input() isPremium: boolean = false;
  @Output() selectDay = new EventEmitter<number>();

  dayOffsets: number[] = Array.from({ length: 13 }, (_, i) => i - 6);

  getDateForOffset(offset: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date;
  }

  formatDate(date: Date, offset: number): string {
    if (offset === 0) return 'Today';
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateNum = date.getDate();
    return `${day} ${dateNum}`;
  }

  onSelectDay(offset: number): void {
    this.selectDay.emit(offset);
  }

  prevDay(): void {
    if (this.selectedDayOffset > -6) {
      this.onSelectDay(this.selectedDayOffset - 1);
    }
  }

  nextDay(): void {
    if (this.selectedDayOffset < 6) {
      this.onSelectDay(this.selectedDayOffset + 1);
    }
  }
}