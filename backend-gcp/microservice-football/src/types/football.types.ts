export interface Prediction {
  matchLabel: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  date: string;
  time: string;
  scores: { [market: string]: number };
  odds: { [market: string]: number };
  isEarlySeason: boolean;
}

export interface PredictionsData {
    [leagueName: string]: Prediction[];
}

export interface Bet {
    id: string;
    league: string;
    matchLabel: string;
    homeTeam: string;
    awayTeam: string;
    homeLogo: string;
    awayLogo: string;
    date: string;
    time: string;
    market: string;
    score: number;
    odd: number;
    isEarlySeason: boolean;
    expectedValue: number;
    profiles: string[];
}

export interface Ticket {
    bets: Bet[];
    totalOdd: number;
}

export interface TicketsData {
    [date: string]: {
        Prudent: Ticket[];
        Equilibre: Ticket[];
        Audacieux: Ticket[];
    };
}

export interface Tranche {
    success: number;
    total: number;
    avgPredicted: number;
}

export interface TrancheAnalysis {
    '0-59': Tranche;
    '60-69': Tranche;
    '70-79': Tranche;
    '80-89': Tranche;
    '90-100': Tranche;
}

export interface Calibration {
    [market: string]: {
        [trancheKey: string]: {
            predicted: string;
            actual: string;
        };
    };
}

export interface BacktestBilan {
    totalMatchesAnalyzed: number;
    globalSummary: TrancheAnalysis;
    perMarketSummary: { [market: string]: TrancheAnalysis };
    marketOccurrences: { [market: string]: number };
    calibration: Calibration;
    earlySeasonSummary: TrancheAnalysis;
}
