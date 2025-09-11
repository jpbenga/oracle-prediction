import { runBacktestSummarizer } from './backtest-summarizer.job';
import { PubSub } from '@google-cloud/pubsub';
import type { CloudEventFunction } from '@google-cloud/functions-framework';

const pubSubClient = new PubSub();
const topicName = 'summary-completed';

export const run: CloudEventFunction = async (cloudEvent) => {
  console.log('Received event:', cloudEvent);
  try {
    await runBacktestSummarizer();
    console.log('Backtest summarizer finished successfully.');

    // Publish a message to the summary-completed topic
    const dataBuffer = Buffer.from('Backtest summarization complete.');
    await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
    console.log(`Message published to ${topicName}.`);

  } catch (error) {
    console.error(error);
  }
};
