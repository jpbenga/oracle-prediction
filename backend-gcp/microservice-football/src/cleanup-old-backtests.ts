import { Firestore } from '@google-cloud/firestore';
import chalk from 'chalk';

/**
 * ==================================================================================
 * ATTENTION : SCRIPT DE SUPPRESSION DE DONNÉES
 * ==================================================================================
 * 
 * Ce script est conçu pour supprimer DÉFINITIVEMENT tous les documents
 * de l'ancienne collection 'backtests'.
 * 
 * USAGE :
 * 1. Assurez-vous d'être authentifié auprès de Google Cloud CLI.
 *    (gcloud auth application-default login)
 * 2. Compilez ce fichier avec le reste du projet (ou directement : tsc src/cleanup-old-backtests.ts).
 * 3. Exécutez le script compilé : node dist/cleanup-old-backtests.js
 * 4. Une fois l'opération terminée, il est recommandé de supprimer ce fichier.
 * 
 * ==================================================================================
 */

const firestore = new Firestore();
const COLLECTION_TO_DELETE = 'backtests';
const BATCH_SIZE = 500; // Firestore ne permet de supprimer que 500 documents à la fois

async function deleteCollection(collectionPath: string) {
  console.log(chalk.cyan(`Début de la suppression de la collection : "${collectionPath}"`));
  const collectionRef = firestore.collection(collectionPath);
  
  let snapshot;
  do {
    snapshot = await collectionRef.limit(BATCH_SIZE).get();
    if (snapshot.empty) {
      break;
    }

    const batch = firestore.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(chalk.yellow(`  - Lot de ${snapshot.size} documents supprimé.`));

  } while (snapshot.size > 0);

  console.log(chalk.green.bold(`Collection "${collectionPath}" supprimée avec succès.`));
}

async function run() {
  console.log(chalk.red.bold('--- SCRIPT DE NETTOYAGE DE LA BASE DE DONNÉES ---'));
  console.log(chalk.yellow('Ce script va supprimer la collection "backtests".'));
  
  // Pour éviter une exécution accidentelle, la ligne de commande est commentée.
  // Décommentez la ligne ci-dessous pour procéder à la suppression.
  
  // await deleteCollection(COLLECTION_TO_DELETE);

  console.log(chalk.blue('Pour exécuter la suppression, décommentez la ligne "await deleteCollection..." dans ce script et relancez-le.'));
  console.log(chalk.red.bold('--- FIN DU SCRIPT ---'));
}

run().catch(error => {
  console.error(chalk.red.bold('Une erreur est survenue :'), error);
});