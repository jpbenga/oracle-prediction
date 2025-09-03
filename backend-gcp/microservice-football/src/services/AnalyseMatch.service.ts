// backend-gcp/microservice-football/src/services/AnalyseMatch.service.ts

import chalk from 'chalk';
import { apiFootballService } from './ApiFootball.service';
import { Match } from '../types/football.types';

// Définition des types directement dans le service pour la clarté
interface TeamStats {
  fixtures: { played: { total: number } };
  goals: {
    for: { average: { total: string | number } };
    against: { average: { total: string | number } };
  };
  form: string; // La forme est souvent une chaîne comme "WLDLW"
}

interface Lambdas {
  home: number;
  away: number;
  ht: number;
  st: number;
  home_ht: number;
  home_st: number;
  away_ht: number;
  away_st: number;
}

class AnalyseMatchService {
  private factorialCache: { [key: number]: number } = { 0: 1, 1: 1 };

  private factorial(n: number): number {
    if (this.factorialCache[n] !== undefined) return this.factorialCache[n];
    if (n < 0) return 0; // Factorial de négatif n'existe pas
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    this.factorialCache[n] = result;
    return result;
  }

  private poissonProbability(k: number, lambda: number): number {
    if (lambda <= 0 || k < 0) return k === 0 ? 1 : 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  private bayesianSmooth(avg: number, matchesPlayed: number, prior = 1.35, priorStrength = 5): number {
    if (matchesPlayed > 0 && matchesPlayed < 6) {
        return (avg * matchesPlayed + prior * priorStrength) / (matchesPlayed + priorStrength);
    }
    return avg;
  }

  private calculateOverUnderProbs(lambda: number): { [key: string]: number } {
    const probs: number[] = Array(7).fill(0).map((_, k) => this.poissonProbability(k, lambda));
    const cumulativeProbs = probs.reduce((acc: number[], p, i) => {
      acc.push((acc[i - 1] || 0) + p);
      return acc;
    }, []);

    return {
      'over_0.5': (1 - (cumulativeProbs[0] || 0)) * 100,
      'under_0.5': (cumulativeProbs[0] || 0) * 100,
      'over_1.5': (1 - (cumulativeProbs[1] || 0)) * 100,
      'under_1.5': (cumulativeProbs[1] || 0) * 100,
      'over_2.5': (1 - (cumulativeProbs[2] || 0)) * 100,
      'under_2.5': (cumulativeProbs[2] || 0) * 100,
      'over_3.5': (1 - (cumulativeProbs[3] || 0)) * 100,
      'under_3.5': (cumulativeProbs[3] || 0) * 100,
    };
  }

  /**
   * Analyse un match en profondeur pour générer des prédictions de confiance.
   * C'est le cœur du modèle prédictif.
   */
  public async analyseMatch(match: Match): Promise<{ markets: { [key: string]: number } } | null> {
    const { teams, league } = match;
    const season = league.season;
    const homeTeamId = teams.home.id;
    const awayTeamId = teams.away.id;

    const [homeStats, awayStats]: [TeamStats | null, TeamStats | null] = await Promise.all([
        apiFootballService.getTeamStats(homeTeamId, league.id, season),
        apiFootballService.getTeamStats(awayTeamId, league.id, season)
    ]);

    if (!homeStats || !awayStats || !homeStats.goals || !awayStats.goals) {
        console.log(chalk.red(`      -> Manque de statistiques pour le match ${teams.home.name} vs ${teams.away.name}.`));
        return null;
    }

    let homeAvgFor = parseFloat(homeStats.goals.for.average.total as string) || 0;
    let homeAvgAgainst = parseFloat(homeStats.goals.against.average.total as string) || 0;
    let awayAvgFor = parseFloat(awayStats.goals.for.average.total as string) || 0;
    let awayAvgAgainst = parseFloat(awayStats.goals.against.average.total as string) || 0;

    const matchesPlayed = homeStats.fixtures.played.total;
    
    if (matchesPlayed > 0 && matchesPlayed < 6) {
        console.log(chalk.yellow(`      -> Début de saison détecté (${matchesPlayed} matchs). Application des corrections.`));
        const [prevHomeStats, prevAwayStats]: [TeamStats | null, TeamStats | null] = await Promise.all([
            apiFootballService.getTeamStats(homeTeamId, league.id, season - 1),
            apiFootballService.getTeamStats(awayTeamId, league.id, season - 1)
        ]);

        let stabilityBoost = 1;
        if (prevHomeStats?.goals && prevAwayStats?.goals) {
            const prevHomeAvgFor = parseFloat(prevHomeStats.goals.for.average.total as string) || homeAvgFor;
            const prevAwayAvgFor = parseFloat(prevAwayStats.goals.for.average.total as string) || awayAvgFor;
            
            const homeStability = Math.abs(prevHomeAvgFor - homeAvgFor) < 0.5 ? 1.1 : 1;
            const awayStability = Math.abs(prevAwayAvgFor - awayAvgFor) < 0.5 ? 1.1 : 1;
            stabilityBoost = (homeStability + awayStability) / 2;

            homeAvgFor = (0.8 * prevHomeAvgFor) + (0.2 * homeAvgFor);
            homeAvgAgainst = (0.8 * (parseFloat(prevHomeStats.goals.against.average.total as string) || homeAvgAgainst)) + (0.2 * homeAvgAgainst);
            awayAvgFor = (0.8 * prevAwayAvgFor) + (0.2 * awayAvgFor);
            awayAvgAgainst = (0.8 * (parseFloat(prevAwayStats.goals.against.average.total as string) || awayAvgAgainst)) + (0.2 * awayAvgAgainst);
        }
        
        homeAvgFor = this.bayesianSmooth(homeAvgFor, matchesPlayed) * stabilityBoost;
        homeAvgAgainst = this.bayesianSmooth(homeAvgAgainst, matchesPlayed) * stabilityBoost;
        awayAvgFor = this.bayesianSmooth(awayAvgFor, matchesPlayed) * stabilityBoost;
        awayAvgAgainst = this.bayesianSmooth(awayAvgAgainst, matchesPlayed) * stabilityBoost;
    }

    const projectedHomeGoals = (homeAvgFor + awayAvgAgainst) / 2;
    const projectedAwayGoals = (awayAvgFor + homeAvgAgainst) / 2;
    
    const lambdaBoost = matchesPlayed >= 6 ? 1.1 : 1;
    const lambdas: Lambdas = {
        home: projectedHomeGoals * lambdaBoost,
        away: projectedAwayGoals * lambdaBoost,
        ht: ((projectedHomeGoals + projectedAwayGoals) * 0.45) * lambdaBoost,
        st: ((projectedHomeGoals + projectedAwayGoals) * 0.55) * lambdaBoost,
        home_ht: (projectedHomeGoals * 0.45) * lambdaBoost,
        home_st: (projectedHomeGoals * 0.55) * lambdaBoost,
        away_ht: (projectedAwayGoals * 0.45) * lambdaBoost,
        away_st: (projectedAwayGoals * 0.55) * lambdaBoost
    };

    return this.predict(lambdas, homeStats, awayStats, projectedHomeGoals, projectedAwayGoals);
  }

  /**
   * Calcule les probabilités des marchés à partir des lambdas et des statistiques.
   */
  public predict(
    lambdas: Lambdas,
    homeStats: TeamStats,
    awayStats: TeamStats,
    projectedHomeGoals: number,
    projectedAwayGoals: number
  ): { markets: { [key: string]: number } } {
    const { home, away, ht, st, home_ht, home_st, away_ht, away_st } = lambdas;
    const markets: { [key: string]: number } = {};

    const segments = { home, away, ht, st, home_ht, home_st, away_ht, away_st };
    for (const prefix in segments) {
      const lambda = segments[prefix as keyof typeof segments];
      const segmentProbs = this.calculateOverUnderProbs(lambda);
      for (const key in segmentProbs) {
        markets[`${prefix}_${key}`] = segmentProbs[key];
      }
    }

    const maxGoals = 8;
    const scoreProbabilities: number[][] = Array(maxGoals + 1).fill(0).map(() => Array(maxGoals + 1).fill(0));
    let homeWinProb = 0, awayWinProb = 0, drawProb = 0;

    for (let i = 0; i <= maxGoals; i++) {
      for (let j = 0; j <= maxGoals; j++) {
        const prob = this.poissonProbability(i, home) * this.poissonProbability(j, away);
        scoreProbabilities[i][j] = prob;
        if (i > j) homeWinProb += prob;
        else if (j > i) awayWinProb += prob;
        else drawProb += prob;
      }
    }

    // Ajustement basé sur la forme et la disparité des buts projetés
    const homeFormPoints = (homeStats.form?.match(/W/g) || []).length * 3 + (homeStats.form?.match(/D/g) || []).length;
    const awayFormPoints = (awayStats.form?.match(/W/g) || []).length * 3 + (awayStats.form?.match(/D/g) || []).length;
    const formFactor = (homeFormPoints - awayFormPoints) / 15; // Normalisé sur le max de points (5 matchs)
    const goalDisparity = Math.abs(projectedHomeGoals - projectedAwayGoals);
    const disparityBoost = goalDisparity > 0.5 ? 1 + (goalDisparity - 0.5) * 0.2 : 1;
    
    homeWinProb *= (1 + formFactor * 0.3) * disparityBoost;
    awayWinProb *= (1 - formFactor * 0.3) * disparityBoost;

    const totalProb = homeWinProb + awayWinProb + drawProb;
    if (totalProb > 0) {
      markets['home_win'] = (homeWinProb / totalProb) * 100;
      markets['away_win'] = (awayWinProb / totalProb) * 100;
      markets['draw'] = (drawProb / totalProb) * 100;
    }

    markets['favorite_win'] = Math.max(markets['home_win'] || 0, markets['away_win'] || 0);
    markets['outsider_win'] = Math.min(markets['home_win'] || 0, markets['away_win'] || 0);
    markets['double_chance_favorite'] = (markets['favorite_win'] || 0) + (markets['draw'] || 0);
    markets['double_chance_outsider'] = (markets['outsider_win'] || 0) + (markets['draw'] || 0);

    let probBttsNo = scoreProbabilities[0][0]; // Prob de 0-0
    for (let i = 1; i <= maxGoals; i++) {
        probBttsNo += scoreProbabilities[i][0] + scoreProbabilities[0][i];
    }

    markets['btts'] = (1 - probBttsNo) * 100;
    markets['btts_no'] = probBttsNo * 100;

    const matchProbs = this.calculateOverUnderProbs(home + away);
    for (const key in matchProbs) {
      markets[`match_${key}`] = matchProbs[key];
    }

    // Ajustement final de calibration (basé sur les observations du prototype)
    if (markets['draw']) markets['draw'] *= 1.2;
    if (markets['favorite_win']) markets['favorite_win'] *= 1.2;
    if (markets['outsider_win']) markets['outsider_win'] *= 1.2;


    return { markets };
  }
}

export const analyseMatchService = new AnalyseMatchService();
