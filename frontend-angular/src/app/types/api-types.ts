// Based on the structure from prediction.job.ts and the needs of the frontend.

export interface Prediction {
  matchLabel: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  date: string; // "dd/MM/yyyy"
  time: string;
  league: string;
  country: string;
  scores: { [market: string]: number };
  odds: { [market: string]: number };
  isEarlySeason: boolean;
  result?: boolean;
}

// The API response for predictions is an object with league names as keys.
export interface PredictionsApiResponse {
  [leagueName: string]: Prediction[];
}

// This is the simplified object we use for display in the prediction-card
export interface DisplayPrediction {
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  time: string;
  prediction: string; // The best prediction market
  confidence: number;
  result?: boolean;
}
