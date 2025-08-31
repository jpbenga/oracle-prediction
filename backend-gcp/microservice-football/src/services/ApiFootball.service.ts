// backend-gcp/microservice-football/src/services/ApiFootball.service.ts

const axios = require('axios');
const chalk = require('chalk');
const { API_HOST, API_KEY, MAX_API_ATTEMPTS } = require('../config/football.config');

interface AxiosInstance {
    get(url: string, config?: any): Promise<any>;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ApiFootballService {
    private api: AxiosInstance;

    constructor() {
        this.api = axios.create({
            baseURL: `https://${API_HOST}`,
            headers: { 'x-apisports-key': API_KEY },
            timeout: 20000
        });
    }

    private async requestWithRetry<T>(apiCall: () => Promise<any>, callName: string): Promise<T | null> {
        let attempts = 0;
        while (attempts < MAX_API_ATTEMPTS) {
            attempts++;
            try {
                console.log(chalk.gray(`      -> Appel API (tentative ${attempts}): ${callName}`));
                const response = await apiCall();

                // Cas 1: Réponse valide avec des données
                if (response.data && response.data.response && response.data.response.length > 0) {
                    console.log(chalk.green(`      -> Succès API pour ${callName}`));
                    return response.data.response as T;
                }

                // Cas 2: Réponse valide mais vide (ex: pas de stats pour une saison)
                if (response.data && response.data.response && response.data.response.length === 0) {
                    console.log(chalk.cyan(`      -> Réponse API vide pour ${callName}, considéré comme un succès (pas de données).`));
                    return response.data.response as T; // Retourne un tableau vide
                }

                // Cas 3: Réponse inattendue, on réessaie
                console.log(chalk.yellow(`      -> Réponse inattendue pour ${callName}, tentative ${attempts}/${MAX_API_ATTEMPTS}.`));
                console.log(chalk.yellow(`         Contenu de la réponse inattendue:`), response.data);

            } catch (error: any) {
                console.log(chalk.yellow(`      -> Erreur API (tentative ${attempts}/${MAX_API_ATTEMPTS}) pour ${callName}: ${error.message}`));
            }
            if (attempts < MAX_API_ATTEMPTS) await sleep(1500);
        }
        console.log(chalk.red(`      -> ERREUR FINALE: Échec de l'appel pour ${callName} après ${MAX_API_ATTEMPTS} tentatives.`));
        return null;
    }

    public async getRounds(leagueId: number, season: number): Promise<string[] | null> {
        return this.requestWithRetry<string[]>(
            () => this.api.get('/fixtures/rounds', { params: { league: leagueId, season, current: 'true' } }),
            `Rounds pour league ${leagueId}, saison ${season}`
        );
    }

    public async getFixturesByRound(leagueId: number, season: number, roundName: string): Promise<any[] | null> {
        return this.requestWithRetry<any[]>(
            () => this.api.get('/fixtures', { params: { league: leagueId, season, round: roundName } }),
            `Fixtures pour league ${leagueId}, round ${roundName}`
        );
    }

    public async getTeamStats(teamId: number, leagueId: number, season: number): Promise<any | null> {
        return this.requestWithRetry<any>(
            () => this.api.get('/teams/statistics', { params: { team: teamId, league: leagueId, season } }),
            `Stats pour équipe ${teamId}`
        );
    }

    public async getOddsForFixture(fixtureId: number): Promise<any[] | null> {
        return this.requestWithRetry<any[]>(
            () => this.api.get('/odds', { params: { fixture: fixtureId } }),
            `Cotes pour match ${fixtureId}`
        );
    }

    public async getFixtureResult(fixtureId: number): Promise<any | null> {
        return this.requestWithRetry<any>(
            () => this.api.get('/fixtures', { params: { id: fixtureId } }),
            `Résultat pour match ${fixtureId}`
        );
    }
}

const apiFootballService = new ApiFootballService();

module.exports = { apiFootballService };