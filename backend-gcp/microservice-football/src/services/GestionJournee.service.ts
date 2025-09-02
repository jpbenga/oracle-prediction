import chalk from 'chalk';
import { apiFootballService } from './ApiFootball.service';

class GestionJourneeService {

    public async getMatchesForBacktesting(leagueId: number, season: number) {
        const rounds = await apiFootballService.getRounds(leagueId, season);
        if (!rounds || rounds.length === 0) {
            console.log(chalk.gray(`      -> Aucune journée trouvée.`));
            return null;
        }

        const currentRoundName = rounds[0];
        if (!currentRoundName) {
            console.log(chalk.gray(`      -> Nom de journée invalide.`));
            return null;
        }
        
        // CORRECTION : Utilisation de la logique de parsing originale et robuste
        const roundParts = currentRoundName.match(/(\D+)(\d+)/);
        if (!roundParts || !roundParts[2] || parseInt(roundParts[2], 10) <= 1) {
            console.log(chalk.gray(`      -> Pas de journée N-1 à analyser.`));
            return null;
        }
        
        const prefix = roundParts[1]?.trim();
        const previousRoundNumber = parseInt(roundParts[2], 10) - 1;
        const previousRoundName = `${prefix} ${previousRoundNumber}`;
        
        console.log(chalk.green(`      -> Journée N-1 identifiée : "${previousRoundName}"`));

        const fixtures = await apiFootballService.getFixturesByRound(leagueId, season, previousRoundName);

        if (!fixtures) {
            console.log(chalk.red(`      -> Impossible de récupérer les matchs pour la journée ${previousRoundName}.`));
            return null;
        }

        const finishedMatches = fixtures.filter((f: any) => f.fixture.status.short === 'FT');
        console.log(chalk.green(`      -> ${finishedMatches.length} match(s) terminé(s) trouvé(s).`));

        return finishedMatches;
    }

    public async getMatchesForPrediction(leagueId: number, season: number) {
        const rounds = await apiFootballService.getRounds(leagueId, season);
        if (!rounds || rounds.length === 0) return [];

        const currentRoundName = rounds[0];
        if (!currentRoundName) {
            console.log(chalk.gray(`      -> Nom de journée invalide.`));
            return [];
        }
        console.log(chalk.green(`      -> Journée actuelle identifiée : "${currentRoundName}"`));

        const fixtures = await apiFootballService.getFixturesByRound(leagueId, season, currentRoundName);
        if (!fixtures) return [];
        
        const upcomingMatches = fixtures.filter((f: any) => f.fixture.status.short === 'NS');
        console.log(chalk.green(`      -> ${upcomingMatches.length} match(s) à venir trouvé(s).`));
        
        return upcomingMatches;
    }
}

export const gestionJourneeService = new GestionJourneeService();