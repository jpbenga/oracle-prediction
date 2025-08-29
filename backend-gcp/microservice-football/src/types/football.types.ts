// backend-gcp/microservice-football/src/types/football.types.ts

// On n'exporte rien ici pour le moment, mais le fichier est prêt pour de futurs types.
// TypeScript va l'utiliser pour vérifier la structure de nos objets.

interface TeamStats {
    fixtures: { played: { total: number } };
    goals: { 
        for: { average: { total: string } }, 
        against: { average: { total: string } } 
    };
    form: string;
}

interface Fixture {
    fixture: { id: number };
    teams: { home: { id: number }, away: { id: number } };
    // Ajoutez d'autres propriétés si nécessaire
}