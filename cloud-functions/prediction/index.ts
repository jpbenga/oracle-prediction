import { runPrediction } from './prediction.job';
import type { CloudEventFunction } from '@google-cloud/functions-framework';

export const run: CloudEventFunction = async (cloudEvent) => {
  console.log('Received event:', cloudEvent);
  try {
    await runPrediction();
    console.log('Prediction job finished successfully.');
  } catch (error) {
    console.error(error);
  }
};
