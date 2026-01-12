/**
 * Debug script to check transcription results
 * Usage: npm run debug:transcription
 */

import { config, validateConfig } from './config/env.js';
import { logger } from './utils/logger.js';
import { sheetsService } from './services/sheetsService.js';

async function debugTranscription() {
  try {
    logger.info('=== Debug Transcription Results ===');

    validateConfig();
    await sheetsService.initialize();

    // Read daily_lessons sheet
    const data = await sheetsService.getSheetData('daily_lessons');

    if (data.length <= 1) {
      logger.error('No data found in daily_lessons sheet');
      return;
    }

    const headers = data[0];
    const rows = data.slice(1);

    // Get the most recent lesson (last row)
    const lastRow = rows[rows.length - 1];

    // Extract relevant fields
    const fileIdIndex = headers.indexOf('drive_file_id');
    const fileNameIndex = headers.indexOf('drive_file_name');
    const durationIndex = headers.indexOf('duration_sec');
    const tutorSpeakingIndex = headers.indexOf('tutor_speaking_sec');
    const studentSpeakingIndex = headers.indexOf('student_speaking_sec');
    const tutorRatioIndex = headers.indexOf('talk_ratio_tutor');
    const statusIndex = headers.indexOf('status');

    logger.info('\n=== Latest Lesson Analysis ===');
    logger.info(`File: ${lastRow[fileNameIndex]}`);
    logger.info(`File ID: ${lastRow[fileIdIndex]}`);
    logger.info(`Status: ${lastRow[statusIndex]}`);
    logger.info(`\nDuration Analysis:`);
    logger.info(`  Total Duration: ${lastRow[durationIndex]}s (${Math.floor(lastRow[durationIndex] / 60)}m ${lastRow[durationIndex] % 60}s)`);
    logger.info(`  Tutor Speaking: ${lastRow[tutorSpeakingIndex]}s (${Math.floor(lastRow[tutorSpeakingIndex] / 60)}m ${lastRow[tutorSpeakingIndex] % 60}s)`);
    logger.info(`  Student Speaking: ${lastRow[studentSpeakingIndex]}s (${Math.floor(lastRow[studentSpeakingIndex] / 60)}m ${lastRow[studentSpeakingIndex] % 60}s)`);
    logger.info(`  Talk Ratio (Tutor): ${(parseFloat(lastRow[tutorRatioIndex]) * 100).toFixed(1)}%`);

    const totalSpeaking = parseInt(lastRow[tutorSpeakingIndex]) + parseInt(lastRow[studentSpeakingIndex]);
    const coverage = (totalSpeaking / parseInt(lastRow[durationIndex]) * 100).toFixed(1);
    
    logger.info(`  Total Speaking: ${totalSpeaking}s`);
    logger.info(`  Coverage: ${coverage}% of video`);

    if (coverage < 10) {
      logger.error(`\n⚠️  WARNING: Coverage is only ${coverage}%!`);
      logger.error('This indicates that transcription is likely incomplete.');
      logger.error('Possible causes:');
      logger.error('  1. Gemini transcription cut off early');
      logger.error('  2. Gemini only transcribed a small portion of the audio');
      logger.error('  3. JSON response parsing issue');
    } else if (coverage < 50) {
      logger.warn(`\n⚠️  Coverage is ${coverage}% - transcription may be incomplete`);
    } else {
      logger.info(`\n✅ Coverage is ${coverage}% - transcription looks good`);
    }

    // Show all lessons summary
    logger.info('\n=== All Lessons Summary ===');
    rows.forEach((row, index) => {
      const duration = parseInt(row[durationIndex]) || 0;
      const tutorSpeaking = parseInt(row[tutorSpeakingIndex]) || 0;
      const studentSpeaking = parseInt(row[studentSpeakingIndex]) || 0;
      const total = tutorSpeaking + studentSpeaking;
      const cov = duration > 0 ? (total / duration * 100).toFixed(1) : 0;
      const status = row[statusIndex];

      logger.info(`${index + 1}. ${row[fileNameIndex].substring(0, 50)}...`);
      logger.info(`   Status: ${status}, Duration: ${duration}s, Coverage: ${cov}%`);
    });

    logger.info('\n=== Debug Complete ===');

  } catch (error) {
    logger.error('Debug failed:', error);
    throw error;
  }
}

// Run
debugTranscription()
  .then(() => {
    logger.info('Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Debug failed with error:', error);
    process.exit(1);
  });
