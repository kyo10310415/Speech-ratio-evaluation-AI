import { logger } from './utils/logger.js';
import { validateConfig } from './config/index.js';
import { jobScheduler } from './scheduler/jobScheduler.js';
import app from './dashboard/server.js';
import { serve } from '@hono/node-server';

/**
 * Main entry point
 * Starts dashboard server and cron job scheduler
 */
async function main() {
  logger.info('🚀 WannaV Lesson Analyzer starting...');

  try {
    // Validate environment configuration
    logger.info('Validating configuration...');
    validateConfig();
    logger.info('✅ Configuration validated');

    // Start job scheduler (cron jobs)
    logger.info('Starting job scheduler...');
    jobScheduler.start();
    logger.info('✅ Job scheduler started');

    // Start dashboard server
    const port = parseInt(process.env.DASHBOARD_PORT || '3000', 10);
    const host = process.env.DASHBOARD_HOST || '0.0.0.0';

    logger.info(`Starting dashboard server on ${host}:${port}...`);
    
    serve({
      fetch: app.fetch,
      port,
      hostname: host
    });

    logger.info(`✅ Dashboard server running at http://${host}:${port}`);
    logger.info('📊 Dashboard: http://localhost:3000');
    logger.info('📅 Daily job scheduled: 09:00 JST (every day)');
    logger.info('📅 Weekly job scheduled: 10:00 JST (every Monday)');

    // Graceful shutdown
    const shutdown = () => {
      logger.info('Shutting down gracefully...');
      jobScheduler.stop();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Run main
main();
