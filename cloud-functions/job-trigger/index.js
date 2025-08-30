const { JobsClient } = require('@google-cloud/run').v2;
const runClient = new JobsClient();

exports.triggerCloudRunJob = async (event, context) => {
  console.log('Déclenchement du job Cloud Run ticket-generator-football...');

  const request = {
    name: 'projects/oracle-prediction-app/locations/europe-west1/jobs/ticket-generator-football',
  };

  try {
    const [response] = await runClient.runJob(request);
    console.log(`Job démarré avec succès. Opération : ${response.name}`);
  } catch (error) {
    console.error('Erreur lors du démarrage du job:', error);
    throw new Error('Impossible de démarrer le job Cloud Run.');
  }
};