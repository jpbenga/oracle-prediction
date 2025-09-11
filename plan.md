Plan Technique Final (Mise à Jour) : Orchestration et Accès aux Données
Note à l'Agent/Développeur : Ce document est la nouvelle source de vérité. Le projet existant, notamment la structure des dossiers dans backend-gcp et cloud-functions, doit être refactorisé pour correspondre à l'architecture simplifiée décrite ci-dessous. L'objectif est de migrer la logique métier des jobs actuels vers une nouvelle structure de Cloud Functions dédiées et orchestrées.

Ce document décrit l'architecture technique pour l'automatisation de la chaîne de traitement des données (le "backend") et la méthode d'accès à ces données pour l'application frontend Angular.

L'architecture est conçue pour être robuste, évolutive et simple à maintenir, en utilisant les services GCP/Firebase et en capitalisant sur votre code existant sans le modifier.

Partie 1 : Architecture Backend - L'Usine Automatisée (GCP)
Le backend est une série de Cloud Functions qui s'exécutent de manière séquentielle, orchestrées par Cloud Scheduler et Pub/Sub. Chaque job que vous avez créé sera encapsulé dans sa propre fonction, garantissant l'isolation et la simplicité du déploiement.

[Image d'une architecture GCP avec Cloud Scheduler, Pub/Sub et Cloud Functions]

Mise en Œuvre :
Nous allons créer un projet cloud-functions qui contiendra des points d'entrée (fichiers index.ts) pour chaque job.

1. Structure du Projet cloud-functions :
Chaque job aura un dossier dédié. La logique métier (backtest-orchestrator.job.ts, etc.) sera importée et simplement exécutée par la fonction.

/cloud-functions
|
├── /backtest-orchestrator
│   ├── index.ts        // Le wrapper de la Cloud Function
│   └── package.json
|
├── /backtest-summarizer
│   ├── index.ts
│   └── package.json
|
├── ... (un dossier pour chaque job)

2. Orchestration du Cycle Principal (1 fois/jour) :

Fonction 1 : run-backtest-orchestrator

Contenu (index.ts) : Importe et exécute la logique de backtest-orchestrator.job.ts.

Déclencheur : Cloud Scheduler, configuré pour s'exécuter tous les jours à 02h00.

À la fin : La fonction publie un message sur le topic Pub/Sub backtest-completed.

Fonction 2 : run-backtest-summarizer

Contenu : Importe et exécute la logique de backtest-summarizer.job.ts.

Déclencheur : Topic Pub/Sub backtest-completed.

À la fin : Publie un message sur le topic summary-completed.

Fonction 3 : run-prediction

Contenu : Importe et exécute la logique de prediction.job.ts.

Déclencheur : Topic Pub/Sub summary-completed.

À la fin : La tâche est terminée, les prédictions sont dans Firestore.

3. Orchestration du Cycle de Finalisation (Toutes les 2 heures) :

Fonction 4 : run-prediction-completer

Contenu : Importe et exécute la logique de prediction-completer.job.ts.

Déclencheur : Cloud Scheduler, configuré pour s'exécuter toutes les 2 heures (0 8-22/2 * * *).

À la fin : Publie un message sur le topic completer-ran.

Fonction 5 : run-ticket-generator

Contenu : Importe et exécute la logique de ticket-generator.job.ts.

Déclencheur : Topic Pub/Sub completer-ran.

À la fin : Les tickets sont mis à jour dans Firestore.

Partie 2 : Communication Frontend - La Vitrine en Temps Réel (Angular)
Plutôt que de créer une API que vous devriez maintenir, nous allons utiliser la méthode la plus simple et la plus puissante offerte par Firebase : la lecture en temps réel depuis Firestore.

Votre application Angular se connectera directement à Firestore. Dès qu'un ticket sera créé ou mis à jour par le backend, l'interface utilisateur se mettra à jour instantanément, sans que l'utilisateur n'ait besoin de rafraîchir la page.

Mise en Œuvre :
1. Service Firestore dans Angular :
Dans votre application Angular, le api.service.ts (ou un nouveau firestore.service.ts) utilisera le SDK Firebase pour écouter les changements sur les collections.

2. Exemple de code pour récupérer les tickets du jour en temps réel :

// Dans votre service Angular
import { collection, query, where, onSnapshot, Firestore } from "firebase/firestore";
import { Observable } from 'rxjs';

// ...

export class ApiService {
  constructor(private firestore: Firestore) {}

  getTicketsForToday(): Observable<any[]> {
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    const ticketsCollection = collection(this.firestore, 'tickets');
    const q = query(ticketsCollection, where("date", "==", today));

    // onSnapshot écoute en temps réel.
    // Chaque fois qu'un ticket est ajouté/modifié/supprimé,
    // ce code s'exécute et met à jour votre application.
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const tickets = [];
        querySnapshot.forEach((doc) => {
          tickets.push({ id: doc.id, ...doc.data() });
        });
        observer.next(tickets);
      });
      // Fonction de nettoyage pour se désabonner quand l'observable n'est plus utilisé
      return () => unsubscribe();
    });
  }
}

3. Sécurité :
La sécurité est garantie par les Règles de Sécurité Firestore. Nous configurerons des règles qui autorisent les utilisateurs authentifiés à lire les collections predictions et tickets, mais interdisent toute écriture. Seul le backend (qui s'exécute avec des droits d'administrateur) pourra écrire dans ces collections.

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Les utilisateurs authentifiés peuvent lire les tickets et les prédictions
    match /tickets/{ticketId} {
      allow read: if request.auth != null;
      allow write: if false; // Personne ne peut écrire depuis le front
    }
    match /predictions/{predictionId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    // ... autres règles pour les profils utilisateurs, etc.
  }
}

Avantages de cette Approche Complète :
Découplage Total : Le backend ne se soucie pas du frontend. Il écrit dans la base de données. Le frontend lit la base de données. Simple et clair.

Temps Réel Natif : L'expérience utilisateur est optimale. Les données s'affichent dès qu'elles sont prêtes.

Zéro Maintenance d'API : Pas de routes à gérer, pas de documentation d'API à écrire, pas de serveurs à maintenir. La base de données EST l'API.

Respect de votre Code : Votre logique métier reste intacte et est simplement orchestrée par des services cloud conçus pour cela.

Si ce plan technique détaillé vous convient, l'étape suivante consistera à créer la structure des dossiers pour les Cloud Functions et à configurer les premiers déclencheurs.
