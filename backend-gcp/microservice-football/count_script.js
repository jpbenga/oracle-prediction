const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore();

async function countDocuments() {
  try {
    const snapshot = await firestore.collection('backtest_results').get();
    console.log(snapshot.size);
  } catch (error) {
    console.error('Erreur lors du comptage des documents:', error);
    process.exit(1);
  }
}

countDocuments();
