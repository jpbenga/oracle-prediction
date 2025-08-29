// backend-gcp/microservice-football/src/services/AnalyseMatch.service.ts

const chalk = require('chalk');
const { apiFootballService } = require('./ApiFootball.service');

// Définition des types pour clarifier le code
interface TeamStats {
    fixtures: { played: { total: number } };
    goals: { 
        for: { average: { total: string | number } }, 
        against: { average: { total: string | number } } 
    };
    form: string;
}

interface Lambdas {
    home: number; away: number; ht: number; st: number;
    home_ht: number; home_st: number; away_ht: number; away_st: number;
}

class AnalyseMatchService {
    private factorialCache: { [key: number]: number } = { 0: 1, 1: 1 };

    private factorial(n: number): number {
        const cachedValue = this.factorialCache[n];
        if (cachedValue !== undefined) {
            return cachedValue;
        }
        if (n < 0) return 0;
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
    
    private calculateOverUnderProbs(lambda: number): { [key: string]: number } {
        const probs: number[] = Array(7).fill(0).map((_, k) => this.poissonProbability(k, lambda));
        
        const cumulativeProbs = probs.reduce((acc: number[], p, i) => {
            acc.push((acc[i - 1] || 0) + p);
            return acc;
        }, []);
        
        return {
            'over_0.5': (1 - (cumulativeProbs[0] || 0)) * 100, 'under_0.5': (cumulativeProbs[0] || 0) * 100,
            'over_1.5': (1 - (cumulativeProbs[1] || 0)) * 100, 'under_1.5': (cumulativeProbs[1] || 0) * 100,
            'over_2.5': (1 - (cumulativeProbs[2] || 0)) * 100, 'under_2.5': (cumulativeProbs[2] || 0) * 100,
            'over_3.5': (1 - (cumulativeProbs[3] || 0)) * 100, 'under_3.5': (cumulativeProbs[3] || 0) * 100,
        };
    }

    public predict(lambdas: Lambdas, homeStats: TeamStats, awayStats: TeamStats, projectedHomeGoals: number, projectedAwayGoals: number) {
        const { home, away, ht, st, home_ht, home_st, away_ht, away_st } = lambdas;
        const markets: { [key: string]: number } = {};
        
        const segments = { home, away, ht, st, home_ht, home_st, away_ht, away_st };
        for (const prefix in segments) {
            const lambda = segments[prefix as keyof typeof segments];
            const segmentProbs = this.calculateOverUnderProbs(lambda);
            for (const key in segmentProbs) {
                const value = segmentProbs[key];
                if (value !== undefined) {
                    markets[`${prefix}_${key}`] = value;
                }
            }
        }

        const maxGoals = 8;
        const scoreProbabilities: number[][] = Array(maxGoals + 1).fill(0).map(() => Array(maxGoals + 1).fill(0));
        let homeWinProb = 0, awayWinProb = 0, drawProb = 0;

        for (let i = 0; i <= maxGoals; i++) {
            for (let j = 0; j <= maxGoals; j++) {
                const prob = this.poissonProbability(i, home) * this.poissonProbability(j, away);
                const row = scoreProbabilities[i];
                if (row) {
                    row[j] = prob;
                }
                if (i > j) homeWinProb += prob;
                else if (j > i) awayWinProb += prob;
                else drawProb += prob;
            }
        }

        const homeFormFactor = homeStats.form ? (parseFloat(homeStats.form) / 100) : 0.5;
        const awayFormFactor = awayStats.form ? (parseFloat(awayStats.form) / 100) : 0.5;
        const goalDisparity = Math.abs(projectedHomeGoals - projectedAwayGoals);
        const disparityBoost = goalDisparity > 0.5 ? 1 + (goalDisparity - 0.5) * 0.2 : 1;
        homeWinProb *= (1 + (homeFormFactor - awayFormFactor) * 0.3) * disparityBoost;
        awayWinProb *= (1 + (awayFormFactor - homeFormFactor) * 0.3) * disparityBoost;
        
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

        let probBttsNo = 0;
        for (let i = 0; i <= maxGoals; i++) { 
            const row = scoreProbabilities[i];
            const firstRow = scoreProbabilities[0];
            if(row && firstRow) {
                probBttsNo += (row[0] || 0) + (firstRow[i] || 0); 
            }
        }
        const cell = scoreProbabilities[0];
        if(cell) {
            probBttsNo -= (cell[0] || 0);
        }

        markets['btts'] = (1 - probBttsNo) * 100;
        markets['btts_no'] = 100 - markets['btts'];
        
        const matchProbs = this.calculateOverUnderProbs(home + away);
        for (const key in matchProbs) { 
            const value = matchProbs[key];
            if (value !== undefined) {
                markets[`match_${key}`] = value;
            }
        }
        
        return { markets };
    }
}

const analyseMatchService = new AnalyseMatchService();

module.exports = { analyseMatchService };