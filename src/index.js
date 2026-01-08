import { logger } from './utils/logger.js';
import { runDailyJob } from './jobs/daily.js';
import { runWeeklyJob } from './jobs/weekly.js';

/**
 * Main entry point
 * Runs appropriate job based on command line argument
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  logger.info('WannaV Lesson Analyzer starting...');
  logger.info(`Command: ${command || 'none'}`);

  try {
    switch (command) {
      case 'daily':
        await runDailyJob();
        break;

      case 'weekly':
        await runWeeklyJob();
        break;

      default:
        logger.error('Invalid command. Usage: node src/index.js [daily|weekly]');
        process.exit(1);
    }

    logger.info('Job completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error('Job failed:', error);
    process.exit(1);
  }
}

// Run main
main();
