import { runTicketGenerator } from './ticket-generator.job';
import type { CloudEventFunction } from '@google-cloud/functions-framework';

export const run: CloudEventFunction = async (cloudEvent) => {
  try {
    const message = JSON.parse(Buffer.from(cloudEvent.data as string, 'base64').toString());
    const date = message.date;

    if (!date) {
      console.error('No date provided in the message.');
      return;
    }

    await runTicketGenerator({ date });
    console.log(`Ticket generator finished successfully for date ${date}.`);

  } catch (error) {
    console.error(error);
  }
};
