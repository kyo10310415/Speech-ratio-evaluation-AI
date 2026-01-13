import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

class JobScheduler {
  constructor() {
    this.jobs = [];
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    logger.info('Starting job scheduler...');

    // Daily job: Run at 09:00 JST
    // Cron format: minute hour day month weekday
    const dailyJob = cron.schedule('0 9 * * *', () => {
      logger.info('🕐 Daily job triggered at 09:00 JST');
      this.runDailyJob();
    }, {
      timezone: 'Asia/Tokyo'
    });

    this.jobs.push({ name: 'daily', job: dailyJob });
    logger.info('✅ Daily job scheduled: 09:00 JST (every day)');

    // Weekly job: Run at 10:00 JST every Monday
    const weeklyJob = cron.schedule('0 10 * * 1', () => {
      logger.info('🕐 Weekly job triggered at 10:00 JST (Monday)');
      this.runWeeklyJob();
    }, {
      timezone: 'Asia/Tokyo'
    });

    this.jobs.push({ name: 'weekly', job: weeklyJob });
    logger.info('✅ Weekly job scheduled: 10:00 JST (every Monday)');

    logger.info(`📅 Job scheduler started with ${this.jobs.length} jobs`);
  }

  /**
   * Run daily job in a separate process
   */
  runDailyJob() {
    const jobPath = join(projectRoot, 'src', 'jobs', 'daily.js');
    
    logger.info(`Spawning daily job: node ${jobPath}`);
    
    const child = spawn('node', [jobPath], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', (error) => {
      logger.error('Failed to start daily job', error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        logger.info('✅ Daily job completed successfully');
      } else {
        logger.error(`❌ Daily job failed with exit code ${code}`);
      }
    });
  }

  /**
   * Run weekly job in a separate process
   */
  runWeeklyJob() {
    const jobPath = join(projectRoot, 'src', 'jobs', 'weekly.js');
    
    logger.info(`Spawning weekly job: node ${jobPath}`);
    
    const child = spawn('node', [jobPath], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', (error) => {
      logger.error('Failed to start weekly job', error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        logger.info('✅ Weekly job completed successfully');
      } else {
        logger.error(`❌ Weekly job failed with exit code ${code}`);
      }
    });
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    logger.info('Stopping job scheduler...');
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    });
    this.jobs = [];
  }

  /**
   * List all scheduled jobs
   */
  list() {
    logger.info('Scheduled jobs:');
    this.jobs.forEach(({ name }) => {
      logger.info(`  - ${name}`);
    });
  }
}

export const jobScheduler = new JobScheduler();
