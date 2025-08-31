import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Prediction } from '@app/types/api-types'; // Import Prediction interface

@Component({
  selector: 'app-raw-data-flow',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './raw-data-flow.html',
  styleUrls: ['./raw-data-flow.scss']
})
export class RawDataFlow {
  @Input() predictions: Prediction[] = [];
  @Input() dayOffset: number = 0;
  @Input() isPremium: boolean = false; // Not directly used in this component, but passed from parent
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  get isPast(): boolean {
    return this.dayOffset < 0;
  }

  getSportIcon(leagueName: string): string {
    switch (leagueName.toLowerCase()) {
      case 'football':
        return ''; // Placeholder for football icon
      case 'basketball':
        return ''; // Placeholder for basketball icon
      default:
        return ''; // Placeholder for default icon
    }
  }

  getBestPredictionDetails(prediction: Prediction): { prediction: string; confidence: number } {
    const scores = prediction.scores;
    let bestMarket = '';
    let maxConfidence = 0;

    for (const market in scores) {
      if (scores.hasOwnProperty(market) && scores[market] > maxConfidence) {
        maxConfidence = scores[market];
        bestMarket = market;
      }
    }
    return { prediction: bestMarket, confidence: maxConfidence };
  }

  calculateSuccessRate(): number | null {
    if (!this.isPast || this.predictions.length === 0) {
      return null;
    }
    // Filter predictions that have a 'result' property (meaning they are past predictions)
    const pastPredictionsWithResult = this.predictions.filter(p => p.result !== undefined);

    if (pastPredictionsWithResult.length === 0) {
      return null; // No past predictions with results to calculate success rate
    }

    const correctPredictions = pastPredictionsWithResult.filter(p => p.result === true).length;
    return (correctPredictions / pastPredictionsWithResult.length) * 100;
  }
}