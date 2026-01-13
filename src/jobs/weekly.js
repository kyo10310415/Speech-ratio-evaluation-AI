import { logger } from '../utils/logger.js';
import { config, validateConfig } from '../config/env.js';
import { getWeeklyDateRange } from '../utils/dateUtils.js';
import { sheetsService } from '../services/sheetsService.js';
import { emotionAnalyzer } from '../analyzers/emotionAnalyzer.js';
import { executeWithLock } from '../utils/jobLock.js';
import {
  WEEKLY_TUTORS_HEADERS,
  calculateWeeklyScore,
} from '../utils/sheetFormatters.js';

/**
 * Weekly job: Aggregate and analyze previous week's lessons
 */
export async function runWeeklyJob() {
  const startTime = Date.now();
  logger.info('========================================');
  logger.info('Starting WEEKLY JOB');
  logger.info('========================================');

  try {
    // Validate configuration
    validateConfig();

    // Get date range (previous week Mon-Sun in JST)
    const { startDate, endDate, weekStartStr, weekEndStr } = getWeeklyDateRange();
    logger.info(`Processing week: ${weekStartStr} to ${weekEndStr}`);
    logger.info(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Initialize services
    await sheetsService.initialize();
    await emotionAnalyzer.initialize();

    logger.info('Services initialized');

    // Read daily_lessons sheet
    const dailyLessonsData = await sheetsService.getSheetData('daily_lessons');

    if (dailyLessonsData.length <= 1) {
      logger.warn('No lessons found in daily_lessons sheet');
      return;
    }

    const headers = dailyLessonsData[0];
    const dateIndex = headers.indexOf('date_jst');
    const tutorIndex = headers.indexOf('tutor_name');
    const statusIndex = headers.indexOf('status');

    if (dateIndex === -1 || tutorIndex === -1) {
      throw new Error('Required columns not found in daily_lessons sheet');
    }

    // Filter lessons for the target week
    const weekLessons = dailyLessonsData.slice(1).filter(row => {
      const dateStr = row[dateIndex];
      const status = row[statusIndex];
      
      // Skip error rows
      if (status === 'ERROR') return false;
      
      // Check if date is within week range
      return dateStr >= weekStartStr && dateStr <= weekEndStr;
    });

    logger.info(`Found ${weekLessons.length} lessons for week ${weekStartStr} to ${weekEndStr}`);

    if (weekLessons.length === 0) {
      logger.info('No lessons to aggregate for this week');
      return;
    }

    // Group by tutor
    const tutorMap = new Map();

    weekLessons.forEach(lesson => {
      const tutorName = lesson[tutorIndex];
      
      if (!tutorMap.has(tutorName)) {
        tutorMap.set(tutorName, []);
      }
      
      tutorMap.get(tutorName).push(lesson);
    });

    logger.info(`Aggregating data for ${tutorMap.size} tutors`);

    // Generate weekly summary rows
    const weeklyRows = [];

    for (const [tutorName, lessons] of tutorMap.entries()) {
      logger.info(`Generating weekly summary for ${tutorName} (${lessons.length} lessons)`);

      // Calculate weekly score
      const { totalScore, breakdown } = calculateWeeklyScore(lessons);

      // Generate key findings
      const keyFindings = await generateWeeklyFindings(lessons, tutorName);

      // Generate top 3 actions
      const actionsTop3 = await generateWeeklyActions(lessons, tutorName, totalScore);

      weeklyRows.push([
        weekStartStr,
        weekEndStr,
        tutorName,
        lessons.length,
        totalScore,
        breakdown,
        keyFindings,
        actionsTop3,
      ]);
    }

    // Write to weekly_tutors sheet
    await sheetsService.getOrCreateSheet('weekly_tutors');
    await sheetsService.writeHeaders('weekly_tutors', WEEKLY_TUTORS_HEADERS);

    if (weeklyRows.length > 0) {
      await sheetsService.appendRows('weekly_tutors', weeklyRows);
      logger.info(`Wrote ${weeklyRows.length} weekly summary rows to weekly_tutors`);
    }

    // Success summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('========================================');
    logger.info(`WEEKLY JOB COMPLETED SUCCESSFULLY in ${duration}s`);
    logger.info(`Processed ${weekLessons.length} lessons for ${tutorMap.size} tutors`);
    logger.info('========================================');

  } catch (error) {
    logger.error('WEEKLY JOB FAILED', error);
    throw error;
  }
}

/**
 * Generate weekly key findings using AI
 * @param {Array} lessons 
 * @param {string} tutorName 
 * @returns {string}
 */
async function generateWeeklyFindings(lessons, tutorName) {
  try {
    const lessonsCount = lessons.length;
    
    // Calculate aggregate metrics
    const avgTalkRatio = lessons.reduce((sum, l) => sum + parseFloat(l[7] || 0), 0) / lessonsCount;
    const avgMaxMonologue = lessons.reduce((sum, l) => sum + parseInt(l[10] || 0), 0) / lessonsCount;
    const avgStudentTurns = lessons.reduce((sum, l) => sum + parseInt(l[13] || 0), 0) / lessonsCount;
    const avgConfusion = lessons.reduce((sum, l) => sum + parseFloat(l[17] || 0), 0) / lessonsCount;

    const findings = `${tutorName}先生は今週${lessonsCount}レッスンを実施。平均発話比率${(avgTalkRatio * 100).toFixed(0)}%、最長連続発話${Math.round(avgMaxMonologue)}秒、生徒発話ターン${Math.round(avgStudentTurns)}回。`;

    return findings;
  } catch (error) {
    logger.error('Failed to generate weekly findings', error);
    return '週次分析情報の生成に失敗';
  }
}

/**
 * Generate top 3 weekly actions using AI
 * @param {Array} lessons 
 * @param {string} tutorName 
 * @param {number} score 
 * @returns {string}
 */
async function generateWeeklyActions(lessons, tutorName, score) {
  try {
    const actions = [];

    // Calculate metrics for recommendations
    const avgTalkRatio = lessons.reduce((sum, l) => sum + parseFloat(l[7] || 0), 0) / lessons.length;
    const avgMaxMonologue = lessons.reduce((sum, l) => sum + parseInt(l[10] || 0), 0) / lessons.length;
    const avgInterruptions = lessons.reduce((sum, l) => sum + parseInt(l[15] || 0), 0) / lessons.length;

    if (avgTalkRatio >= 0.60) {
      actions.push('講師発話を減らし、生徒に要約や言い換えを依頼する時間を増やす');
    }

    if (avgMaxMonologue >= 180) {
      actions.push('3分ごとに理解確認の質問を挟み、生徒のアウトプット機会を作る');
    }

    if (avgInterruptions >= 3) {
      actions.push('生徒の発話を最後まで聞き、間を十分に取ってから応答する');
    }

    // Default action if score is already high
    if (actions.length === 0 && score >= 80) {
      actions.push('現在の対話バランスを維持しつつ、生徒の自発的発話をさらに促す');
    }

    // Fallback
    if (actions.length === 0) {
      actions.push('生徒の発話機会を増やすため、オープンクエスチョンを活用する');
    }

    return actions.slice(0, 3).join('\n');
  } catch (error) {
    logger.error('Failed to generate weekly actions', error);
    return '週次アクションの生成に失敗';
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  executeWithLock('weekly-job', runWeeklyJob)
    .then(() => {
      logger.info('Weekly job finished');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Weekly job failed with error:', error);
      process.exit(1);
    });
}
