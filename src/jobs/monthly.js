import { logger } from '../utils/logger.js';
import { config, validateConfig } from '../config/env.js';
import { getMonthlyDateRange } from '../utils/dateUtils.js';
import { sheetsService } from '../services/sheetsService.js';
import { driveService } from '../services/driveService.js';
import { audioService } from '../services/audioService.js';
import { transcriptionService } from '../services/transcriptionService.js';
import { emotionAnalyzer } from '../analyzers/emotionAnalyzer.js';
import { processTutorFolder } from '../services/lessonProcessor.js';
import { processInParallel, calculateOptimalConcurrency } from '../utils/parallelProcessor.js';
import { executeWithLock } from '../utils/jobLock.js';
import {
  DAILY_LESSONS_HEADERS,
  DAILY_TUTORS_HEADERS,
  aggregateDailyTutors,
} from '../utils/sheetFormatters.js';

/**
 * Randomly select N items from array
 * @param {Array} array - Source array
 * @param {number} count - Number of items to select
 * @returns {Array} - Randomly selected items
 */
function randomSelect(array, count) {
  if (array.length <= count) {
    return array;
  }
  
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Monthly job: Process random 2 lessons per tutor from current month
 * @param {string} testDate - Optional date string (YYYY-MM-DD) for testing (uses that month)
 */
export async function runMonthlyJob(testDate = null) {
  const startTime = Date.now();
  logger.info('========================================');
  logger.info('Starting MONTHLY JOB');
  if (testDate) {
    logger.info(`TEST MODE: Processing month containing ${testDate}`);
  }
  logger.info('========================================');

  try {
    // Validate configuration
    validateConfig();

    // Get date range (current month in JST or specified test date's month)
    const { startDate, endDate, monthStr } = getMonthlyDateRange(testDate);
    logger.info(`Processing month: ${monthStr}`);
    logger.info(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Initialize services
    await sheetsService.initialize();
    await driveService.initialize();
    await audioService.initialize();
    await transcriptionService.initialize();
    await emotionAnalyzer.initialize();

    logger.info('All services initialized');

    // Read input sheet
    const tutorRecords = await sheetsService.readInputSheet();
    logger.info(`Found ${tutorRecords.length} tutor records`);

    if (tutorRecords.length === 0) {
      logger.warn('No tutor records found in input sheet');
      return;
    }

    // Get processed file IDs (for idempotency)
    const processedFileIds = await sheetsService.getProcessedFileIds();
    logger.info(`Found ${processedFileIds.size} already processed files`);

    // Ensure monthly_lessons sheet exists with headers
    await sheetsService.getOrCreateSheet('monthly_lessons');
    await sheetsService.writeHeaders('monthly_lessons', DAILY_LESSONS_HEADERS);

    // Calculate optimal concurrency
    const concurrency = calculateOptimalConcurrency(tutorRecords.length, config.maxConcurrency);
    logger.info(`Using concurrency: ${concurrency}`);

    // Process each tutor's folder in parallel
    const { results, errors } = await processInParallel(
      tutorRecords,
      async (record) => {
        const { tutorName, folderUrl } = record;

        if (!tutorName || !folderUrl) {
          logger.warn('Skipping invalid record:', record);
          return [];
        }

        logger.info(`Processing tutor: ${tutorName}`);

        // Get all videos in the month
        const allRows = await processTutorFolder({
          tutorName,
          folderUrl,
          dateJst: monthStr,
          startDate,
          endDate,
          processedFileIds,
          skipProcessing: true, // Only list videos, don't process yet
        });

        if (allRows.length === 0) {
          logger.info(`No videos found for ${tutorName} in ${monthStr}`);
          return [];
        }

        logger.info(`Found ${allRows.length} videos for ${tutorName} in ${monthStr}`);

        // Randomly select 2 videos
        const selectedRows = randomSelect(allRows, 2);
        logger.info(`Randomly selected ${selectedRows.length} videos for ${tutorName}`);

        // Process selected videos
        const processedRows = [];
        for (const videoInfo of selectedRows) {
          try {
            logger.info(`Processing selected video: ${videoInfo.fileName}`);
            
            // Process single video
            const rows = await processTutorFolder({
              tutorName,
              folderUrl,
              dateJst: monthStr,
              startDate,
              endDate,
              processedFileIds,
              specificFileId: videoInfo.fileId, // Process only this file
            });

            processedRows.push(...rows);
          } catch (error) {
            logger.error(`Failed to process video ${videoInfo.fileName}:`, error);
          }
        }

        return processedRows;
      },
      concurrency
    );

    // Flatten results
    const allLessonRows = results.flat();
    
    // Log errors if any
    if (errors.length > 0) {
      logger.error(`Encountered ${errors.length} errors during processing:`);
      errors.forEach(({ tutorName, error }) => {
        logger.error(`  - ${tutorName}: ${error.message}`);
      });
    }

    // Write to monthly_lessons sheet
    if (allLessonRows.length > 0) {
      await sheetsService.appendRows('monthly_lessons', allLessonRows);
      logger.info(`Appended ${allLessonRows.length} rows to monthly_lessons`);
    } else {
      logger.info('No lesson rows to write');
    }

    // Aggregate tutors and write to monthly_tutors sheet
    const tutorRows = aggregateDailyTutors(allLessonRows);
    
    if (tutorRows.length > 0) {
      await sheetsService.getOrCreateSheet('monthly_tutors');
      await sheetsService.writeHeaders('monthly_tutors', DAILY_TUTORS_HEADERS);
      await sheetsService.appendRows('monthly_tutors', tutorRows);
      logger.info(`Appended ${tutorRows.length} rows to monthly_tutors`);
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('========================================');
    logger.info(`MONTHLY JOB COMPLETED SUCCESSFULLY in ${duration}s`);
    logger.info(`Processed ${allLessonRows.length} lessons (random 2 per tutor)`);
    logger.info(`Parallel processing: ${results.length} succeeded, ${errors.length} failed`);
    logger.info('========================================');

  } catch (error) {
    logger.error('MONTHLY JOB FAILED:', error);
    throw error;
  }
}

// If executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testDate = process.argv[2]; // Optional: 'YYYY-MM-DD'
  
  executeWithLock('monthly-job', () => runMonthlyJob(testDate))
    .then(() => {
      logger.info('Monthly job finished');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Monthly job failed:', error);
      process.exit(1);
    });
}
