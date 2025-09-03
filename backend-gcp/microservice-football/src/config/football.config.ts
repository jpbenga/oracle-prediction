// backend-gcp/microservice-football/src/config/football.config.ts

/**
 * Exporte une configuration centralisée pour toute l'application.
 */
export const footballConfig = {
    /**
     * Clé API pour se connecter à api-sports.io.
     * Utilise une variable d'environnement pour la sécurité.
     */
    apiKey: process.env.API_KEY || '7f7700a471beeeb52aecde406a3870ba',
  
    /**
     * Hôte de l'API.
     */
    apiHost: 'v3.football.api-sports.io',
  
    /**
     * Nombre maximum de tentatives pour un appel API échoué.
     */
    maxApiAttempts: 5,
  
    /**
     * Liste de toutes les ligues à analyser par le système.
     */
    leaguesToAnalyze: [
      { name: 'Bundesliga', id: 78 }, { name: 'Bundesliga 2', id: 79 },
      { name: 'Premier League', id: 39 }, { name: 'Championship', id: 40 },
      { name: 'Saudi Pro League', id: 307 }, { name: 'Liga Profesional', id: 128 },
      { name: 'Bundesliga (Autriche)', id: 218 }, { name: 'Pro League', id: 144 },
      { name: 'Série A (Brésil)', id: 71 }, { name: 'Parva Liga', id: 172 },
      { name: 'Primera Division (Chili)', id: 265 }, { name: 'Super League (Chine)', id: 169 },
      { name: 'Primera A', id: 239 }, { name: 'K League 1', id: 292 },
      { name: 'HNL', id: 210 }, { name: 'Superliga', id: 119 },
      { name: 'Premiership', id: 179 }, { name: 'Liga Pro', id: 240 },
      { name: 'La Liga', id: 140 }, { name: 'La Liga 2', id: 141 },
      { name: 'Meistriliiga', id: 327 }, { name: 'MLS', id: 253 },
      { name: 'Veikkausliga', id: 244 }, { name: 'Ligue 1', id: 61 },
      { name: 'Ligue 2', id: 62 }, { name: 'Erovnuli Liga', id: 329 },
      { name: 'Super League (Grèce)', id: 197 }, { name: 'OTP Bank Liga', id: 271 },
      { name: 'Premier Division', id: 357 }, { name: 'Besta deild karla', id: 164 },
      { name: 'Serie A', id: 135 }, { name: 'Serie B', id: 136 },
      { name: 'J1 League', id: 98 }, { name: 'A Lyga', id: 331 },
      { name: 'Liga MX', id: 262 }, { name: 'Eliteserien', id: 103 },
      { name: 'Primera Division (Paraguay)', id: 284 }, { name: 'Eredivisie', id: 88 },
      { name: 'Cymru Premier', id: 110 }, { name: 'Ekstraklasa', id: 106 },
      { name: 'Liga Portugal', id: 94 }, { name: 'Liga Portugal 2', id: 95 },
      { name: 'Fortuna Liga', id: 345 }, { name: 'Liga 1', id: 283 },
      { name: 'Super Liga', id: 286 }, { name: 'Nike Liga', id: 334 },
      { name: 'Prva Liga', id: 373 }, { name: 'Allsvenskan', id: 113 },
      { name: 'Super League (Suisse)', id: 207 }, { name: 'Super Lig', id: 203 },
      { name: 'Premier League (Ukraine)', id: 235 }
    ],
  
    /**
     * Marchés considérés comme ayant une faible occurrence, à traiter différemment.
     */
    lowOccurrenceMarkets: [
      'away_ht_over_3.5',
      'home_ht_over_3.5',
      'away_st_over_3.5',
      'home_st_over_3.5',
    ],
  };