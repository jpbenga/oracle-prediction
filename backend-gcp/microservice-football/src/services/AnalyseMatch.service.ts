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

    public predict(lambdas: Lambdas, homeStats: TeamStats, awayStats: TeamStats) {
        const { home, away, ht, st, home_ht, home_st, away_ht, away_st } = lambdas;
        const markets: { [key: string]: number } = {};
        
        const segments = { home, away, ht, st, home_ht, home_st, away_ht, away_st };
        for (const prefix in segments) {
            const lambda = segments[prefix as keyof typeof segments];
            const segmentProbs = this.calculateOverUnderProbs(lambda);
            for (const key in segmentProbs) {
                // CORRECTION FINALE : On vérifie que la valeur existe avant de l'assigner.
                const value = segmentProbs[key];
                if (value !== undefined) {
                    markets[`${prefix}_${key}`] = value;
                }
            }
        }

        const maxGoals = 8;
        let homeWinProb = 0, awayWinProb = 0, drawProb = 0;
        let probBttsNo = 0;

        for (let i = 0; i <= maxGoals; i++) {
            for (let j = 0; j <= maxGoals; j++) {
                const prob = this.poissonProbability(i, home) * this.poissonProbability(j, away);
                if (i > j) homeWinProb += prob;
                else if (j > i) awayWinProb += prob;
                else drawProb += prob;
                
                if (i === 0 || j === 0) {
                    probBttsNo += prob;
                }
            }
        }
        probBttsNo -= this.poissonProbability(0, home) * this.poissonProbability(0, away);

        const totalProb = homeWinProb + awayWinProb + drawProb;
        if (totalProb > 0) {
            markets['home_win'] = (homeWinProb / totalProb) * 100;
            markets['away_win'] = (awayWinProb / totalProb) * 100;
            markets['draw'] = (drawProb / totalProb) * 100;
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