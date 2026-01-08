import { logger } from '../utils/logger.js';
import { config, validateConfig } from '../config/env.js';
import { getDailyDateRange } from '../utils/dateUtils.js';
import { sheetsService } from '../services/sheetsService.js';
import { driveService } from '../services/driveService.js';
import { audioService } from '../services/audioService.js';
import { transcriptionService } from '../services/transcriptionService.js';
import { emotionAnalyzer } from '../analyzers/emotionAnalyzer.js';
import { processTutorFolder } from '../services/lessonProcessor.js';
import {
  DAILY_LESSONS_HEADERS,
  DAILY_TUTORS_HEADERS,
  aggregateDailyTutors,
} from '../utils/sheetFormatters.js';

/**
 * Daily job: Process previous day's lessons
 */
export async function runDailyJob() {
  const startTime = Date.now();
  logger.info('========================================');
  logger.info('Starting DAILY JOB');
  logger.info('========================================');

  try {
    // Validate configuration
    validateConfig();

    // Get date range (previous day in JST)
    const { startDate, endDate, dateStr } = getDailyDateRange();
    logger.info(`Processing date: ${dateStr}`);
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

    // Ensure daily_lessons sheet exists with headers
    await sheetsService.getOrCreateSheet('daily_lessons');
    await sheetsService.writeHeaders('daily_lessons', DAILY_LESSONS_HEADERS);

    // Process each tutor's folder
    const allLessonRows = [];

    for (const record of tutorRecords) {
      const { tutorName, folderUrl } = record;

      if (!tutorName || !folderUrl) {
        logger.warn('Skipping invalid record:', record);
        continue;
      }

      logger.info(`Processing tutor: ${tutorName}`);

      const rows = await processTutorFolder({
        tutorName,
        folderUrl,
        dateJst: dateStr,
        startDate,
        endDate,
        processedFileIds,
      });

      allLessonRows.push(...rows);
    }

    // Write lesson rows to daily_lessons
    if (allLessonRows.length > 0) {
      await sheetsService.appendRows('daily_lessons', allLessonRows);
      logger.info(`Wrote ${allLessonRows.length} lesson rows to daily_lessons`);
    } else {
      logger.info('No new lessons to write');
    }

    // Aggregate and write daily_tutors
    await sheetsService.getOrCreateSheet('daily_tutors');
    await sheetsService.writeHeaders('daily_tutors', DAILY_TUTORS_HEADERS);

    const dailyTutorRows = aggregateDailyTutors(allLessonRows, dateStr);
    
    if (dailyTutorRows.length > 0) {
      await sheetsService.appendRows('daily_tutors', dailyTutorRows);
      logger.info(`Wrote ${dailyTutorRows.length} tutor summary rows to daily_tutors`);
    }

    // Success summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('========================================');
    logger.info(`DAILY JOB COMPLETED SUCCESSFULLY in ${duration}s`);
    logger.info(`Processed ${allLessonRows.length} lessons`);
    logger.info('========================================');

  } catch (error) {
    logger.error('DAILY JOB FAILED', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDailyJob()
    .then(() => {
      logger.info('Daily job finished');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Daily job failed with error:', error);
      process.exit(1);
    });
}
