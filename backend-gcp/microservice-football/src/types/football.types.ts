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

export interface Match {
    fixture: {
      id: number;
      date: string;
      venue: {
        name: string | null;
        city: string | null;
      };
      status: {
        long: string;
        short: string;
        elapsed: number | null;
      };
    };
    league: {
      id: number;
      name: string;
      country: string;
      logo: string;
      flag: string;
      season: number;
      round: string;
    };
    teams: {
      home: {
        id: number;
        name: string;
        logo: string;
        winner: boolean | null;
      };
      away: {
        id: number;
        name: string;
        logo: string;
        winner: boolean | null;
      };
    };
    goals: {
      home: number | null;
      away: number | null;
    };
    score: {
      halftime: {
        home: number | null;
        away: number | null;
      };
      fulltime: {
        home: number | null;
        away: number | null;
      };
      extratime: {
        home: number | null;
        away: number | null;
      };
      penalty: {
        home: number | null;
        away: number | null;
      };
    };
  }

export interface PredictionsData {
    [leagueName: string]: Prediction[];
}

export interface BacktestResult {
    matchId: number;
    matchLabel: string;
    matchDate: string;
    markets: Array<{
      market: string;
      prediction: number;
      result: 'WON' | 'LOST' | 'PENDING';
    }>;
  }

  export interface PredictionDocument {
    id: string;
    fixtureId: number;
    matchLabel: string;
    matchDate: string;
    leagueId: number;
    leagueName: string;
    market: string;
    score: number;
    odd: number | null;
    status: 'ELIGIBLE' | 'INCOMPLETE' | 'PENDING' | 'WON' | 'LOST';
    createdAt: string;
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
