import { runPredictionCompleter } from './prediction-completer.job';
import { PubSub } from '@google-cloud/pubsub';
import type { HttpFunction } from '@google-cloud/functions-framework';

const pubSubClient = new PubSub();
const topicName = 'completer-ran';

export const run: HttpFunction = async (req, res) => {
  try {
    const updatedDates = await runPredictionCompleter();
    console.log('Prediction completer finished successfully.');

    // Publish a message for each updated date
    for (const date of updatedDates) {
      const dataBuffer = Buffer.from(JSON.stringify({ date }));
      await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
      console.log(`Message published to ${topicName} for date ${date}.`);
    }

    res.status(200).send('Prediction completer finished successfully.');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred during prediction completion.');
  }
};
