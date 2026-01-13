import { logger } from './logger.js';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { config } from '../config/env.js';

/**
 * Simple file-based lock mechanism to prevent concurrent job execution
 */
class JobLock {
  constructor(lockName) {
    this.lockName = lockName;
    this.lockFile = join(config.tempDir, `${lockName}.lock`);
  }

  /**
   * Try to acquire lock
   * @returns {boolean} true if lock acquired, false if already locked
   */
  acquire() {
    try {
      // Ensure temp directory exists
      const lockDir = dirname(this.lockFile);
      if (!existsSync(lockDir)) {
        logger.info(`Creating lock directory: ${lockDir}`);
        mkdirSync(lockDir, { recursive: true });
      }

      // Check if lock file exists
      if (existsSync(this.lockFile)) {
        const lockData = JSON.parse(readFileSync(this.lockFile, 'utf-8'));
        const lockAge = Date.now() - lockData.timestamp;

        // If lock is older than 4 hours, consider it stale and override
        if (lockAge > 4 * 60 * 60 * 1000) {
          logger.warn(`Stale lock detected (${lockAge}ms old), overriding...`);
          this.release();
        } else {
          logger.warn(`Job already running (locked at ${new Date(lockData.timestamp).toISOString()})`);
          return false;
        }
      }

      // Create lock file
      const lockData = {
        timestamp: Date.now(),
        pid: process.pid,
        lockName: this.lockName
      };

      writeFileSync(this.lockFile, JSON.stringify(lockData, null, 2));
      logger.info(`Lock acquired: ${this.lockName}`);
      return true;

    } catch (error) {
      logger.error(`Failed to acquire lock: ${error.message}`);
      return false;
    }
  }

  /**
   * Release lock
   */
  release() {
    try {
      if (existsSync(this.lockFile)) {
        unlinkSync(this.lockFile);
        logger.info(`Lock released: ${this.lockName}`);
      }
    } catch (error) {
      logger.error(`Failed to release lock: ${error.message}`);
    }
  }

  /**
   * Check if job is currently locked
   * @returns {boolean}
   */
  isLocked() {
    if (!existsSync(this.lockFile)) {
      return false;
    }

    try {
      const lockData = JSON.parse(readFileSync(this.lockFile, 'utf-8'));
      const lockAge = Date.now() - lockData.timestamp;

      // Consider stale if older than 4 hours
      if (lockAge > 4 * 60 * 60 * 1000) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Execute job with lock protection
 * @param {string} lockName - Unique lock name for the job
 * @param {Function} jobFunction - Async function to execute
 * @returns {Promise<void>}
 */
export async function executeWithLock(lockName, jobFunction) {
  const lock = new JobLock(lockName);

  // Try to acquire lock
  if (!lock.acquire()) {
    logger.warn(`Skipping ${lockName} - job already running`);
    return;
  }

  try {
    // Execute job
    await jobFunction();
  } finally {
    // Always release lock
    lock.release();
  }
}

export { JobLock };
