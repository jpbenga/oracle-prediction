# Plan d'Action : Architecture d'un Système de Pronostics Autonome sur GCP

## 1. Vision Stratégique 🎯

L'objectif est de construire une application de pronostics sportifs **autonome, résiliente et dynamique**. Le système doit s'adapter aux aléas de la disponibilité des données (cotes) et à la logique métier spécifique du football (analyse par journée de championnat), tout en garantissant que les pronostics et tickets proposés à l'utilisateur sont toujours les plus pertinents possibles.

L'architecture s'appuiera sur des services managés de **Google Cloud Platform (GCP)** pour minimiser la gestion d'infrastructure et maximiser la scalabilité et la rentabilité.

---

## 2. Architecture Technique sur GCP ☁️

L'écosystème sera composé de trois services GCP principaux qui interagiront en permanence.



* ### **`Firestore` (La Mémoire d'État)**
    * **Rôle :** Base de données NoSQL centrale. Elle ne sert pas uniquement de stockage, mais de véritable "cerveau" qui conserve l'état de l'application en temps réel.
    * **Usage :** Stockage des pronostics, des tickets, de l'état des championnats et des bilans statistiques.

* ### **`Cloud Run` (La Force de Calcul)**
    * **Rôle :** Plateforme d'exécution pour nos microservices conteneurisés (Docker). Elle est serverless, ce qui signifie que nous ne payons que lorsque le code s'exécute.
    * **Usage :** Chaque "mission" de notre système sera un Job ou un Service Cloud Run indépendant.

* ### **`Cloud Scheduler` (L'Horloge)**
    * **Rôle :** Service de planification (CRON) qui déclenchera nos jobs de manière autonome selon un calendrier défini.
    * **Usage :** Automatisation complète du workflow, du backtest à la mise à jour des résultats.

---

## 3. Modélisation des Données dans Firestore 📝

La structure de la base de données est cruciale pour le bon fonctionnement de la logique métier.

* ### Collection : `leagues_status`
    * **Objectif :** Suivre la progression de l'analyse pour chaque championnat.
    * **Structure d'un document (ID = `FR1`) :**
        ```json
        {
          "leagueName": "Ligue 1",
          "currentMatchdayNumber": 22,
          "currentMatchdayStatus": "COMPLETED", // (ANALYZING, COMPLETED)
          "lastAnalysisTimestamp": "2025-08-30T10:00:00Z"
        }
        ```

* ### Collection : `predictions`
    * **Objectif :** Stocker chaque pronostic individuel et suivre son cycle de vie.
    * **Structure d'un document :**
        ```json
        {
          "matchLabel": "Liverpool vs Man City",
          "matchDate": "2025-09-02T19:00:00Z",
          "leagueId": "GB1",
          "market": "home_st_over_0.5",
          "score": 96.0,
          "odd": 1.85,
          "status": "ELIGIBLE" // (INCOMPLETE, ELIGIBLE, PENDING, WON, LOST)
        }
        ```

* ### Collection : `tickets`
    * **Objectif :** Stocker les tickets générés, prêts à être affichés.
    * **Structure d'un document :**
        ```json
        {
          "profile_key": "PROFILE_PRUDENT",
          "total_odd": 2.5,
          "creation_date": "2025-08-31",
          "status": "PENDING", // (PENDING, WON, LOST)
          "bet_refs": [
            "/predictions/docId1",
            "/predictions/docId2"
          ]
        }
        ```

---

## 4. Les Microservices (Jobs Cloud Run) ⚙️

Chaque job a une responsabilité unique, ce qui rend le système modulaire et facile à maintenir.

1.  **`backtest-job` (Le Statisticien)**
    * **Déclencheur :** `Cloud Scheduler` (1 fois par jour).
    * **Mission :** Maintient les statistiques de performance en fenêtre glissante (7 jours) dans Firestore.

2.  **`league-orchestrator-job` (Le Chef d'Orchestre)**
    * **Déclencheur :** `Cloud Scheduler` (toutes les 6 heures).
    * **Mission :** Vérifie l'état de chaque championnat dans `leagues_status`. Si une journée est terminée, il déclenche le `prediction-job` pour la journée suivante.

3.  **`prediction-job` (L'Analyste)**
    * **Déclencheur :** `league-orchestrator-job`.
    * **Mission :** Analyse tous les matchs d'une nouvelle journée de championnat. Sauvegarde les pronostics, même ceux avec des données manquantes (statut `INCOMPLETE`).

4.  **`prediction-completer-job` (L'Inspecteur des Travaux Finis)**
    * **Déclencheur :** `Cloud Scheduler` (2 fois par jour, ex: 10h et 18h).
    * **Mission :** Cherche les pronostics avec le statut `INCOMPLETE`. Tente de récupérer les données manquantes (cotes). S'il y parvient, il change leur statut à `ELIGIBLE` et **déclenche le `ticket-generator-job`**.

5.  **`ticket-generator-job` (Le Constructeur Dynamique)**
    * **Déclencheur :** `prediction-job` OU `prediction-completer-job`.
    * **Mission :**
        1.  Supprime les tickets `PENDING` existants pour un jour donné.
        2.  Récupère TOUS les pronostics `ELIGIBLE` pour ce jour.
        3.  Calcule et sauvegarde les nouvelles combinaisons de tickets optimisées.

6.  **`results-updater-service` (Le Greffier)**
    * **Déclencheur :** `Cloud Scheduler` (toutes les 15 minutes).
    * **Mission :** Met à jour le statut (`WON`/`LOST`) des pronostics et tickets dont les matchs sont terminés.

---

## 5. Flux de Travail et Réactivité : Un Exemple Concret 🔄

Le scénario d'une "pépite" qui arrive tardivement illustre la puissance du système :

* **Jour 1 (Mardi) :** Le `prediction-job` analyse la journée de samedi et génère un pronostic "Liverpool - Man City" avec un score de 96%, mais sans cote. Il est sauvegardé avec le statut `INCOMPLETE`. Une première série de tickets est générée sans lui.
* **Jour 2 (Mercredi, 10h) :** Le `prediction-completer-job` ("l'inspecteur") s'exécute. Il trouve une cote pour le match de Liverpool.
    1.  Il met à jour le pronostic dans Firestore avec la cote et passe son statut à `ELIGIBLE`.
    2.  Puisqu'il a modifié une donnée critique, il **déclenche immédiatement le `ticket-generator-job`** pour la journée de samedi.
* **Jour 2 (Mercredi, 10h01) :** Le `ticket-generator-job` est invoqué.
    1.  Il **supprime** les tickets de samedi générés la veille.
    2.  Il récupère la nouvelle liste complète de pronostics `ELIGIBLE`, incluant maintenant la pépite de Liverpool.
    3.  Il **regénère de nouveaux tickets optimisés** qui intègrent ce pronostic à haute valeur, assurant que l'utilisateur reçoit la meilleure proposition possible.

Ce plan d'action établit les fondations d'un système professionnel, capable de fonctionner sans intervention manuelle tout en s'adaptant intelligemment aux conditions réelles du monde des paris sportifs.