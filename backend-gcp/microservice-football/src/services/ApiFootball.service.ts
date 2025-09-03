import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import { Match } from '../types/football.types';
import { footballConfig } from '../config/football.config';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ApiFootballService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: 'https://v3.football.api-sports.io',
      headers: {
        'x-rapidapi-host': footballConfig.apiHost,
        'x-rapidapi-key': footballConfig.apiKey,
      },
      timeout: 20000, // Ajout d'un timeout
    });
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, any>): Promise<T | null> {
    let attempts = 0;
    while (attempts < footballConfig.maxApiAttempts) {
      attempts++;
      try {
        const response = await this.api.get(endpoint, { params });
        if (response.data && response.data.response) {
          return response.data.response;
        }
      } catch (error) {
        console.log(chalk.yellow(`      -> Tentative API ${attempts}/${footballConfig.maxApiAttempts} (${endpoint}) échouée`));
      }
      if (attempts < footballConfig.maxApiAttempts) await sleep(1500);
    }
    console.log(chalk.red(`      -> ERREUR FINALE: Impossible de récupérer les données pour ${endpoint} après ${footballConfig.maxApiAttempts} tentatives.`));
    return null;
  }

  async getTeamStats(teamId: number, leagueId: number, season: number): Promise<any> {
    return this.makeRequest<any>('/teams/statistics', { team: teamId, league: leagueId, season });
  }

  async getOddsForFixture(fixtureId: number): Promise<any> {
    return this.makeRequest<any>('/odds', { fixture: fixtureId });
  }

  async getRounds(leagueId: number, season: number): Promise<string[] | null> {
    return this.makeRequest<string[]>('/fixtures/rounds', { league: leagueId, season, current: 'false' });
  }
    
  async getFixturesByRound(leagueId: number, season: number, round: string): Promise<Match[] | null> {
    return this.makeRequest<Match[]>('/fixtures', { league: leagueId, season, round });
  }

  async getMatchesByDateRange(fromDate: string, toDate: string, leagueId: number, season: number): Promise<Match[] | null> {
    return this.makeRequest<Match[]>('/fixtures', { from: fromDate, to: toDate, league: leagueId, season: season });
  }

  async getMatchById(matchId: number): Promise<Match | null> {
    const results = await this.makeRequest<Match[]>('/fixtures', { id: matchId });
    return results && results.length > 0 ? results[0] : null;
  }
}

export const apiFootballService = new ApiFootballService();