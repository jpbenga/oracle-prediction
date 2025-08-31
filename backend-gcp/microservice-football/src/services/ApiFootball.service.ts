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

    private async requestWithRetry<T>(apiCall: () => Promise<any>, callName: string, expectArray: boolean = true): Promise<T | null> {
        let attempts = 0;
        while (attempts < MAX_API_ATTEMPTS) {
            attempts++;
            try {
                console.log(chalk.gray(`       -> Appel API (tentative ${attempts}): ${callName}`));
                const response = await apiCall();
                const apiResponseData = response.data.response;

                if (expectArray && Array.isArray(apiResponseData)) {
                     if (apiResponseData.length > 0) {
                        console.log(chalk.green(`       -> Succès API pour ${callName} (tableau avec données)`));
                        return apiResponseData as T;
                     } else {
                        console.log(chalk.cyan(`       -> Réponse API vide pour ${callName}, considéré comme un succès (tableau vide).`));
                        return apiResponseData as T;
                     }
                }

                if (!expectArray && typeof apiResponseData === 'object' && apiResponseData !== null && !Array.isArray(apiResponseData)) {
                    console.log(chalk.green(`       -> Succès API pour ${callName} (objet)`));
                    return apiResponseData as T;
                }
                
                console.log(chalk.yellow(`       -> Réponse inattendue pour ${callName}, tentative ${attempts}/${MAX_API_ATTEMPTS}.`));
                
                // CORRECTION: Utilisation de util.inspect pour afficher correctement les objets imbriqués
                const util = require('util');
                console.log(chalk.yellow(`          Contenu de la réponse inattendue:`));
                console.log(util.inspect(response.data, { 
                    depth: null,        // Affiche tous les niveaux d'imbrication
                    colors: true,       // Couleurs pour une meilleure lisibilité
                    maxArrayLength: null, // Affiche tous les éléments des tableaux
                    maxStringLength: null, // Affiche les chaînes complètes
                    breakLength: 80     // Largeur d'affichage
                }));

            } catch (error: any) {
                console.log(chalk.yellow(`       -> Erreur API (tentative ${attempts}/${MAX_API_ATTEMPTS}) pour ${callName}: ${error.message}`));
            }
            if (attempts < MAX_API_ATTEMPTS) await sleep(1500);
        }
        console.log(chalk.red(`       -> ERREUR FINALE: Échec de l'appel pour ${callName} après ${MAX_API_ATTEMPTS} tentatives.`));
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
            `Stats pour équipe ${teamId}`,
            false
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