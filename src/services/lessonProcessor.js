import { logger } from '../utils/logger.js';
import { driveService } from '../services/driveService.js';
import { audioService } from '../services/audioService.js';
import { transcriptionService } from '../services/transcriptionService.js';
import { analyzeLessonKPIs } from '../analyzers/kpiAnalyzer.js';
import { emotionAnalyzer } from '../analyzers/emotionAnalyzer.js';
import { formatDailyLessonRow, formatErrorRow } from '../utils/sheetFormatters.js';
import { unlinkSync } from 'fs';

/**
 * Process a single lesson video
 * @param {Object} params
 * @returns {Object} { row, success }
 */
export async function processLesson({
  tutorName,
  folderUrl,
  file,
  dateJst,
}) {
  const fileId = file.id;
  const fileName = file.name;
  const createdTime = file.createdTime;

  let videoPath = null;
  let audioPath = null;

  try {
    logger.info(`Processing lesson: ${fileName} (${fileId})`);

    // Step 1: Download video
    videoPath = await driveService.downloadFile(fileId, fileName);

    // Step 2: Extract and normalize audio
    const { audioPath: processedAudioPath, duration } = await audioService.processVideo(videoPath, fileId);
    audioPath = processedAudioPath;

    logger.info(`Audio processed, duration: ${duration}s`);

    // Step 3: Transcribe and diarize
    const { utterances } = await transcriptionService.transcribeAndDiarize(audioPath);

    if (utterances.length === 0) {
      throw new Error('No utterances detected - audio quality may be too poor');
    }

    logger.info(`Transcription complete: ${utterances.length} utterances`);

    // Step 4: Analyze KPIs
    const kpis = analyzeLessonKPIs(utterances, duration);

    // Step 5: Analyze emotions
    const emotions = await emotionAnalyzer.analyzeEmotionalSignals(utterances);

    // Step 6: Generate report
    const report = await emotionAnalyzer.generateReport(kpis, emotions);

    // Step 7: Format row
    const row = formatDailyLessonRow({
      dateJst,
      tutorName,
      folderUrl,
      fileId,
      fileName,
      createdTime,
      duration,
      kpis,
      emotions,
      report,
      status: 'OK',
    });

    logger.info(`Lesson processed successfully: ${fileName}`);

    // Cleanup temp files
    cleanup(videoPath, audioPath);

    return { row, success: true };

  } catch (error) {
    logger.error(`Failed to process lesson: ${fileName}`, error);

    // Cleanup temp files
    cleanup(videoPath, audioPath);

    // Return error row
    const errorRow = formatErrorRow({
      dateJst,
      tutorName,
      folderUrl,
      fileId,
      fileName,
      createdTime,
      errorMessage: error.message || 'Unknown error',
    });

    return { row: errorRow, success: false };
  }
}

/**
 * Cleanup temporary files
 * @param {...string} paths 
 */
function cleanup(...paths) {
  for (const path of paths) {
    if (path) {
      try {
        unlinkSync(path);
        logger.debug(`Cleaned up: ${path}`);
      } catch (err) {
        logger.warn(`Failed to cleanup ${path}:`, err.message);
      }
    }
  }
}

/**
 * Process all lessons for a tutor's folder
 * @param {Object} params
 * @param {boolean} skipProcessing - If true, only return video info without processing
 * @param {string} specificFileId - If provided, only process this specific file
 * @returns {Array} Array of rows or video info objects
 */
export async function processTutorFolder({
  tutorName,
  folderUrl,
  dateJst,
  startDate,
  endDate,
  processedFileIds,
  skipProcessing = false,
  specificFileId = null,
}) {
  const rows = [];

  try {
    // Extract folder ID
    const folderId = driveService.extractFolderId(folderUrl);
    logger.info(`Processing folder for ${tutorName}: ${folderId}`);

    // List videos in date range
    const files = await driveService.listVideosInFolder(folderId, startDate, endDate);

    if (files.length === 0) {
      logger.info(`No videos found for ${tutorName} in date range`);
      return rows;
    }

    // If specificFileId is provided, filter to only that file
    let targetFiles = files;
    if (specificFileId) {
      targetFiles = files.filter(f => f.id === specificFileId);
      if (targetFiles.length === 0) {
        logger.warn(`Specific file ${specificFileId} not found`);
        return rows;
      }
    }

    // Filter out already processed files (unless specificFileId is set)
    const unprocessedFiles = specificFileId 
      ? targetFiles 
      : targetFiles.filter(f => !processedFileIds.has(f.id));

    if (unprocessedFiles.length === 0) {
      logger.info(`All ${targetFiles.length} videos already processed for ${tutorName}`);
      return rows;
    }

    logger.info(`Found ${unprocessedFiles.length} unprocessed videos for ${tutorName}`);

    // If skipProcessing, return video info only
    if (skipProcessing) {
      return unprocessedFiles.map(file => ({
        fileId: file.id,
        fileName: file.name,
        createdTime: file.createdTime,
      }));
    }

    // Process each video
    for (const file of unprocessedFiles) {
      const { row } = await processLesson({
        tutorName,
        folderUrl,
        file,
        dateJst,
      });

      rows.push(row);
    }

    return rows;

  } catch (error) {
    logger.error(`Failed to process folder for ${tutorName}`, error);

    // Return error row for folder access failure
    const errorRow = formatErrorRow({
      dateJst,
      tutorName,
      folderUrl,
      errorMessage: `Folder access error: ${error.message}`,
    });

    return [errorRow];
  }
}
