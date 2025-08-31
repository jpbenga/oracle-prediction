import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PredictionCard } from '../prediction-card/prediction-card';
import { RawDataFlow } from '../raw-data-flow/raw-data-flow'; 
import { Prediction } from '@app/types/api-types'; // Import Prediction from api-types

// This is a simplified version for display purposes in the card
export type DisplayPrediction = {
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  time: string;
  prediction: string; // The best prediction market
  confidence: number;
  result?: boolean;
};

@Component({
  selector: 'app-predictions-list',
  standalone: true,
  imports: [CommonModule, PredictionCard, RawDataFlow], 
  templateUrl: './predictions-list.html',
  styleUrls: ['./predictions-list.scss']
})
export class PredictionsList implements OnChanges {
  @Input() allPredictions: { [leagueName: string]: Prediction[] } | null = null;
  @Input() dayOffset: number = 0;
  @Input() isPremium: boolean = false;

  displayPredictions: DisplayPrediction[] = [];
  allRawPredictionsFlattened: Prediction[] = []; // New property
  successRate: number | null = null;
  sevenDayRate: number = 82; // Hardcoded as per prototype
  showRawData = false;

  get isRawDataLocked(): boolean {
    return !this.isPremium && this.dayOffset > 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allPredictions'] || changes['dayOffset']) {
      this.updatePredictionsForDay();
      this.flattenAllRawPredictions(); // Call new method
    }
  }

  openRawData(): void {
    if (!this.isRawDataLocked) {
      this.showRawData = true;
    }
  }

  closeRawData(): void {
    this.showRawData = false;
  }

  private getSelectedDayKey(): string {
    const date = new Date();
    date.setDate(date.getDate() + this.dayOffset);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private updatePredictionsForDay(): void {
    this.displayPredictions = [];
    this.successRate = null;

    if (!this.allPredictions) {
      return;
    }

    const targetDate = this.getSelectedDayKey();
    const matchesForDay: Prediction[] = [];

    for (const leagueName in this.allPredictions) {
      if (this.allPredictions.hasOwnProperty(leagueName)) {
        const leaguePredictions = this.allPredictions[leagueName];
        const filtered = leaguePredictions.filter(p => p.date === targetDate);
        matchesForDay.push(...filtered);
      }
    }

    this.displayPredictions = matchesForDay.map(match => {
      const scores = match.scores;
      let bestMarket = '';
      let maxConfidence = 0;

      for (const market in scores) {
        if (scores[market] > maxConfidence) {
          maxConfidence = scores[market];
          bestMarket = market;
        }
      }

      return {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeLogo: match.homeLogo,
        awayLogo: match.awayLogo,
        league: match.leagueName,
        time: match.time,
        prediction: bestMarket,
        confidence: maxConfidence,
        result: this.dayOffset < 0 ? (Math.random() > 0.3) : undefined
      };
    }).filter(p => p.prediction);

    if (this.dayOffset < 0 && this.displayPredictions.length > 0) {
      const correctCount = this.displayPredictions.filter(p => p.result === true).length;
      this.successRate = (correctCount / this.displayPredictions.length) * 100;
    }
  }

  private flattenAllRawPredictions(): void {
    this.allRawPredictionsFlattened = [];
    if (!this.allPredictions) {
      return;
    }
    for (const leagueName in this.allPredictions) {
      if (this.allPredictions.hasOwnProperty(leagueName)) {
        this.allRawPredictionsFlattened.push(...this.allPredictions[leagueName]);
      }
    }
  }
}
