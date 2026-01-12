/**
 * Error monitoring script
 * Usage: npm run monitor:errors
 */

import { config, validateConfig } from './config/env.js';
import { logger } from './utils/logger.js';
import { sheetsService } from './services/sheetsService.js';

/**
 * Analyze errors from daily_lessons sheet
 */
async function monitorErrors() {
  try {
    logger.info('=== Starting Error Monitoring ===');

    validateConfig();
    await sheetsService.initialize();

    // Read daily_lessons sheet
    const data = await sheetsService.getSheetData('daily_lessons');

    if (data.length <= 1) {
      logger.info('No data found in daily_lessons sheet');
      return;
    }

    const headers = data[0];
    const rows = data.slice(1);

    // Find status column
    const statusIndex = headers.indexOf('status');
    const dateIndex = headers.indexOf('date_jst');
    const tutorIndex = headers.indexOf('tutor_name');
    const errorIndex = headers.indexOf('error_message');

    if (statusIndex === -1) {
      logger.error('Status column not found');
      return;
    }

    // Count total and errors
    const total = rows.length;
    const errorRows = rows.filter(row => row[statusIndex] === 'ERROR');
    const successRows = rows.filter(row => row[statusIndex] === 'OK');
    const errorCount = errorRows.length;
    const errorRate = (errorCount / total * 100).toFixed(2);

    logger.info('\n=== Error Summary ===');
    logger.info(`Total Lessons: ${total}`);
    logger.info(`Successful: ${successRows.length} (${(successRows.length / total * 100).toFixed(2)}%)`);
    logger.info(`Failed: ${errorCount} (${errorRate}%)`);

    // Alert if error rate is high
    if (errorRate > 20) {
      logger.error(`\n⚠️  HIGH ERROR RATE: ${errorRate}%`);
      logger.error('This requires immediate investigation!');
    } else if (errorRate > 10) {
      logger.warn(`\n⚠️  Elevated error rate: ${errorRate}%`);
      logger.warn('Monitor closely and investigate if it increases.');
    } else {
      logger.info(`\n✅ Error rate is acceptable: ${errorRate}%`);
    }

    // Group errors by date
    if (errorCount > 0) {
      logger.info('\n=== Errors by Date ===');
      const errorsByDate = {};
      
      errorRows.forEach(row => {
        const date = row[dateIndex] || 'Unknown';
        if (!errorsByDate[date]) {
          errorsByDate[date] = [];
        }
        errorsByDate[date].push({
          tutor: row[tutorIndex],
          error: row[errorIndex],
        });
      });

      Object.keys(errorsByDate).sort().reverse().forEach(date => {
        const errors = errorsByDate[date];
        logger.info(`\n${date}: ${errors.length} error(s)`);
        errors.forEach(({ tutor, error }) => {
          logger.info(`  - ${tutor}: ${error.substring(0, 100)}...`);
        });
      });
    }

    // Group errors by tutor
    if (errorCount > 0) {
      logger.info('\n=== Errors by Tutor ===');
      const errorsByTutor = {};
      
      errorRows.forEach(row => {
        const tutor = row[tutorIndex] || 'Unknown';
        if (!errorsByTutor[tutor]) {
          errorsByTutor[tutor] = 0;
        }
        errorsByTutor[tutor]++;
      });

      const sortedTutors = Object.entries(errorsByTutor)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      sortedTutors.forEach(([tutor, count]) => {
        logger.info(`  ${tutor}: ${count} error(s)`);
      });
    }

    // Group errors by error type
    if (errorCount > 0) {
      logger.info('\n=== Common Error Types ===');
      const errorTypes = {};
      
      errorRows.forEach(row => {
        const errorMsg = row[errorIndex] || 'Unknown error';
        // Extract error type (first line or first 50 chars)
        const errorType = errorMsg.split('\n')[0].substring(0, 80);
        
        if (!errorTypes[errorType]) {
          errorTypes[errorType] = 0;
        }
        errorTypes[errorType]++;
      });

      const sortedErrors = Object.entries(errorTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      sortedErrors.forEach(([type, count]) => {
        logger.info(`  ${count}x: ${type}`);
      });
    }

    // Recent trends (last 7 days)
    logger.info('\n=== Recent Trends (Last 7 Days) ===');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentRows = rows.filter(row => {
      const dateStr = row[dateIndex];
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date >= sevenDaysAgo;
    });

    if (recentRows.length === 0) {
      logger.info('No data in the last 7 days');
    } else {
      const recentErrors = recentRows.filter(row => row[statusIndex] === 'ERROR');
      const recentErrorRate = (recentErrors.length / recentRows.length * 100).toFixed(2);
      
      logger.info(`Lessons: ${recentRows.length}`);
      logger.info(`Errors: ${recentErrors.length} (${recentErrorRate}%)`);
      
      if (recentErrorRate > errorRate) {
        logger.warn(`⚠️  Error rate is increasing (was ${errorRate}%, now ${recentErrorRate}%)`);
      } else if (recentErrorRate < errorRate) {
        logger.info(`✅ Error rate is decreasing (was ${errorRate}%, now ${recentErrorRate}%)`);
      }
    }

    logger.info('\n=== Monitoring Complete ===');

  } catch (error) {
    logger.error('Error monitoring failed:', error);
    throw error;
  }
}

// Run
monitorErrors()
  .then(() => {
    logger.info('Monitoring complete');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Monitoring failed with error:', error);
    process.exit(1);
  });
