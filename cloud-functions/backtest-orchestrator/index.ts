import { runBacktestOrchestrator } from './backtest-orchestrator.job';
import type { HttpFunction } from '@google-cloud/functions-framework';

export const run: HttpFunction = async (req, res) => {
  try {
    await runBacktestOrchestrator();
    res.status(200).send('Backtest orchestrator finished successfully.');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred during backtest orchestration.');
  }
};
