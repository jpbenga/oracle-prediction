

const chalk = require('chalk');
const { firestoreService } = require('../services/Firestore.service');
const { apiFootballService } = require('../services/ApiFootball.service');
const { runTicketGenerator } = require('./ticket-generator.job');

function parseOdds(oddsData: any[]) {
    if (!oddsData || oddsData.length === 0) return {};
    const parsed: { [key: string]: number } = {};
    const fixtureOdds = oddsData[0];
    for (const bookmaker of fixtureOdds.bookmakers) {
        const matchWinnerBet = bookmaker.bets.find((b: any) => b.id === 1);
        const doubleChanceBet = bookmaker.bets.find((b: any) => b.id === 12);
        if (matchWinnerBet) {
            const homeOdd = parseFloat(matchWinnerBet.values.find((v: any) => v.value === 'Home')?.odd);
            const drawOdd = parseFloat(matchWinnerBet.values.find((v: any) => v.value === 'Draw')?.odd);
            const awayOdd = parseFloat(matchWinnerBet.values.find((v: any) => v.value === 'Away')?.odd);
            if (homeOdd && drawOdd && awayOdd) {
                if (!parsed['draw']) parsed['draw'] = drawOdd;
                const isHomeFavorite = homeOdd < awayOdd;
                if (!parsed['favorite_win']) parsed['favorite_win'] = isHomeFavorite ? homeOdd : awayOdd;
                if (!parsed['outsider_win']) parsed['outsider_win'] = isHomeFavorite ? awayOdd : homeOdd;
                if (doubleChanceBet) {
                    const homeDrawOdd = parseFloat(doubleChanceBet.values.find((v: any) => v.value === 'Home/Draw')?.odd);
                    const awayDrawOdd = parseFloat(doubleChanceBet.values.find((v: any) => v.value === 'Draw/Away')?.odd);
                    if (homeDrawOdd && awayDrawOdd) {
                        if (!parsed['double_chance_favorite']) parsed['double_chance_favorite'] = isHomeFavorite ? homeDrawOdd : awayDrawOdd;
                        if (!parsed['double_chance_outsider']) parsed['double_chance_outsider'] = isHomeFavorite ? awayDrawOdd : homeDrawOdd;
                    }
                }
            }
        }
        for (const bet of bookmaker.bets) {
            switch (bet.id) {
                case 5: bet.values.forEach((v: any) => { const k = `match_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 8: bet.values.forEach((v: any) => { const k = v.value === 'Yes' ? 'btts' : 'btts_no'; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 16: bet.values.forEach((v: any) => { const k = `home_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 17: bet.values.forEach((v: any) => { const k = `away_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 6: bet.values.forEach((v: any) => { const k = `ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 26: bet.values.forEach((v: any) => { const k = `st_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 105: bet.values.forEach((v: any) => { const k = `home_ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 106: bet.values.forEach((v: any) => { const k = `away_ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
            }
        }
    }
    return parsed;
}

async function runPredictionCompleter() {
    console.log(chalk.blue.bold("--- Démarrage du Job de Complétion des Prédictions ---"));
    const incompletePredictions = await firestoreService.getIncompletePredictions();

    if (incompletePredictions.length === 0) {
        console.log(chalk.yellow("Aucune prédiction incomplète trouvée. Fin du job."));
        return;
    }

    const updatedDates: { [date: string]: boolean } = {};

    for (const prediction of incompletePredictions) {
        console.log(chalk.cyan(`\n[Complétion] Traitement de la prédiction : ${prediction.matchLabel} (ID: ${prediction.id})`));
        
        const oddsData = await apiFootballService.getOddsForFixture(prediction.fixtureId);
        if (oddsData && oddsData.length > 0) {
            const parsedOdds = parseOdds(oddsData);

            if (!prediction.market) {
                console.log(chalk.red(`  -> Marché manquant pour la prédiction ${prediction.id}. Saut.`));
                continue;
            }
            const market = prediction.market;
            const oddForMarket = parsedOdds[market];

            if (oddForMarket) {
                console.log(chalk.green(`  -> Cote trouvée pour le marché ${market}. Mise à jour de la prédiction.`));
                await firestoreService.updatePrediction(prediction.id, {
                    odd: oddForMarket,
                    status: 'ELIGIBLE'
                });
                
                if (prediction.matchDate) {
                    const d = new Date(prediction.matchDate);
                    if (!isNaN(d.getTime())) {
                        const matchDateStr = d.toISOString().split('T')[0];
                        if (matchDateStr) {
                            updatedDates[matchDateStr] = true;
                        }
                    } else {
                        console.log(chalk.red(`    -> Date invalide trouvée pour la prédiction ${prediction.id}: ${prediction.matchDate}`));
                    }
                } else {
                     console.log(chalk.red(`    -> Date manquante pour la prédiction ${prediction.id}.`));
                }

            } else {
                console.log(chalk.yellow(`  -> Aucune cote trouvée pour le marché spécifique ${market}.`));
            }
        } else {
            console.log(chalk.red(`  -> Aucune donnée de cote trouvée pour le match.`));
        }
    }

    const datesToGenerate = Object.keys(updatedDates);
    if (datesToGenerate.length > 0) {
        console.log(chalk.magenta.bold(`\n-> Des prédictions ont été complétées. Déclenchement du ticket-generator pour les dates: ${datesToGenerate.join(', ')}`));
        for (const date of datesToGenerate) {
            await runTicketGenerator({ date });
        }
    }

    console.log(chalk.blue.bold("--- Job de Complétion des Prédictions Terminé ---"));
}

module.exports = { runPredictionCompleter };

// Lancer le job
runPredictionCompleter();