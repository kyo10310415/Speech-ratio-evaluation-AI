import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { JobLock } from '../utils/jobLock.js';

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

    // DISABLED: Daily job was previously at 09:00 JST
    // const dailyJob = cron.schedule('0 9 * * *', () => {
    //   logger.info('🕐 Daily job triggered at 09:00 JST');
    //   this.runDailyJob();
    // }, {
    //   timezone: 'Asia/Tokyo'
    // });
    // this.jobs.push({ name: 'daily', job: dailyJob });
    // logger.info('✅ Daily job scheduled: 09:00 JST (every day)');

    // DISABLED: Weekly job was previously at 12:00 JST every Monday
    // const weeklyJob = cron.schedule('0 12 * * 1', () => {
    //   logger.info('🕐 Weekly job triggered at 12:00 JST (Monday)');
    //   this.runWeeklyJob();
    // }, {
    //   timezone: 'Asia/Tokyo'
    // });
    // this.jobs.push({ name: 'weekly', job: weeklyJob });
    // logger.info('✅ Weekly job scheduled: 12:00 JST (every Monday)');

    // Monthly job: Run at 23:00 JST on the last day of each month
    // Cron format: minute hour day-of-month month day-of-week
    // 'L' is not supported, so we use a workaround:
    // Run on 28-31 and check if it's the last day
    const monthlyJob = cron.schedule('0 23 28-31 * *', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      // Check if tomorrow is the 1st (meaning today is the last day)
      if (tomorrow.getDate() === 1) {
        logger.info('🕐 Monthly job triggered at 23:00 JST (last day of month)');
        this.runMonthlyJob();
      } else {
        logger.debug('Not the last day of month, skipping monthly job');
      }
    }, {
      timezone: 'Asia/Tokyo'
    });

    this.jobs.push({ name: 'monthly', job: monthlyJob });
    logger.info('✅ Monthly job scheduled: 23:00 JST (last day of each month)');

    logger.info(`📅 Job scheduler started with ${this.jobs.length} jobs`);
  }

  /**
   * Run daily job in a separate process
   */
  runDailyJob() {
    // Check if job is already running
    const lock = new JobLock('daily-job');
    if (lock.isLocked()) {
      logger.warn('⚠️ Daily job already running, skipping...');
      return;
    }

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
    // Check if job is already running
    const lock = new JobLock('weekly-job');
    if (lock.isLocked()) {
      logger.warn('⚠️ Weekly job already running, skipping...');
      return;
    }

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
   * Run monthly job in a separate process
   */
  runMonthlyJob() {
    // Check if job is already running
    const lock = new JobLock('monthly-job');
    if (lock.isLocked()) {
      logger.warn('⚠️ Monthly job already running, skipping...');
      return;
    }

    const jobPath = join(projectRoot, 'src', 'jobs', 'monthly.js');
    
    logger.info(`Spawning monthly job: node ${jobPath}`);
    
    const child = spawn('node', [jobPath], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', (error) => {
      logger.error('Failed to start monthly job', error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        logger.info('✅ Monthly job completed successfully');
      } else {
        logger.error(`❌ Monthly job failed with exit code ${code}`);
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
