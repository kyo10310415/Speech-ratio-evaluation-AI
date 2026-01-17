import { toJSTString } from '../utils/dateUtils.js';

/**
 * Headers for daily_lessons sheet
 */
export const DAILY_LESSONS_HEADERS = [
  'date_jst',
  'tutor_name',
  'source_folder_url',
  'drive_file_id',
  'drive_file_name',
  'created_time_jst',
  'duration_sec',
  'talk_ratio_tutor',
  'tutor_speaking_sec',
  'student_speaking_sec',
  'max_tutor_monologue_sec',
  'monologue_over_3min_count',
  'monologue_over_5min_count',
  'student_turns',
  'student_silence_over_15s_count',
  'interruptions_tutor_over_student',
  'interruptions_student_over_tutor',
  'confusion_ratio_est',
  'stress_ratio_est',
  'positive_ratio_est',
  'confusion_top3',
  'stress_top3',
  'positive_top3',
  'improvement_advice',
  'recommended_actions',
  'status',
  'error_message',
];

/**
 * Headers for daily_tutors sheet
 */
export const DAILY_TUTORS_HEADERS = [
  'date_jst',
  'tutor_name',
  'lessons_count',
  'avg_talk_ratio_tutor',
  'avg_max_tutor_monologue_sec',
  'total_interruptions_tutor_over_student',
  'avg_confusion_ratio_est',
  'avg_stress_ratio_est',
  'alerts',
];

/**
 * Headers for monthly_tutors sheet
 */
export const MONTHLY_TUTORS_HEADERS = [
  'date_jst',
  'tutor_name',
  'lessons_count',
  'avg_tutor_talk_ratio',
  'avg_silence_15s_count',
  'total_duration_min',
];

/**
 * Headers for weekly_tutors sheet
 */
export const WEEKLY_TUTORS_HEADERS = [
  'week_start_jst',
  'week_end_jst',
  'tutor_name',
  'lessons_count',
  'weekly_score_total',
  'score_breakdown',
  'weekly_key_findings',
  'weekly_actions_top3',
];

/**
 * Format lesson analysis result for daily_lessons sheet
 * @param {Object} params
 * @returns {Array} Row data
 */
export function formatDailyLessonRow({
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
  status = 'OK',
  errorMessage = '',
}) {
  return [
    dateJst,
    tutorName,
    folderUrl,
    fileId,
    fileName,
    toJSTString(createdTime),
    duration,
    kpis.talkRatioTutor,
    Math.round(kpis.tutorSpeakingMs / 1000),
    Math.round(kpis.studentSpeakingMs / 1000),
    Math.round(kpis.maxTutorMonologueMs / 1000),
    kpis.monologueOver3MinCount,
    kpis.monologueOver5MinCount,
    kpis.studentTurns,
    kpis.studentSilenceOver15sCount,
    kpis.interruptionsTutorOverStudent,
    kpis.interruptionsStudentOverTutor,
    emotions.confusionRatioEst,
    emotions.stressRatioEst,
    emotions.positiveRatioEst,
    emotions.confusionTop3,
    emotions.stressTop3,
    emotions.positiveTop3,
    report.improvementAdvice,
    report.recommendedActions,
    status,
    errorMessage,
  ];
}

/**
 * Format error row for daily_lessons sheet
 * @param {Object} params
 * @returns {Array} Row data
 */
export function formatErrorRow({
  dateJst,
  tutorName,
  folderUrl,
  fileId = '',
  fileName = '',
  createdTime = '',
  errorMessage = '',
}) {
  return [
    dateJst,
    tutorName,
    folderUrl,
    fileId,
    fileName,
    createdTime ? toJSTString(createdTime) : '',
    0, // duration
    0, // talk_ratio_tutor
    0, // tutor_speaking_sec
    0, // student_speaking_sec
    0, // max_tutor_monologue_sec
    0, // monologue_over_3min_count
    0, // monologue_over_5min_count
    0, // student_turns
    0, // student_silence_over_15s_count
    0, // interruptions_tutor_over_student
    0, // interruptions_student_over_tutor
    0, // confusion_ratio_est
    0, // stress_ratio_est
    0, // positive_ratio_est
    '', // confusion_top3
    '', // stress_top3
    '', // positive_top3
    '', // improvement_advice
    '', // recommended_actions
    'ERROR',
    errorMessage,
  ];
}

/**
 * Aggregate daily lessons by tutor
 * @param {Array} lessons - Array of lesson rows
 * @param {string} dateJst 
 * @returns {Array} Array of daily_tutors rows
 */
/**
 * Aggregate monthly tutors summary
 * @param {Array} lessons - Array of lesson rows
 * @param {string} monthJst - Month string (YYYY-MM)
 * @returns {Array} Array of tutor summary rows
 */
export function aggregateMonthlyTutors(lessons, monthJst) {
  const tutorMap = new Map();

  lessons.forEach(lesson => {
    const tutorName = lesson[1]; // tutor_name column
    const status = lesson[25]; // status column

    if (status === 'ERROR') return; // Skip errors

    if (!tutorMap.has(tutorName)) {
      tutorMap.set(tutorName, {
        lessons: [],
      });
    }

    tutorMap.get(tutorName).lessons.push(lesson);
  });

  const rows = [];

  tutorMap.forEach((data, tutorName) => {
    const lessonsCount = data.lessons.length;
    
    if (lessonsCount === 0) return;

    // Calculate averages
    const avgTalkRatio = data.lessons.reduce((sum, l) => sum + parseFloat(l[7] || 0), 0) / lessonsCount;
    const avgSilence15s = data.lessons.reduce((sum, l) => sum + parseInt(l[14] || 0), 0) / lessonsCount;
    const totalDurationSec = data.lessons.reduce((sum, l) => sum + parseInt(l[6] || 0), 0);
    const totalDurationMin = totalDurationSec / 60;

    rows.push([
      monthJst,
      tutorName,
      lessonsCount,
      parseFloat(avgTalkRatio.toFixed(3)),
      parseFloat(avgSilence15s.toFixed(1)),
      parseFloat(totalDurationMin.toFixed(1)),
    ]);
  });

  return rows;
}

export function aggregateDailyTutors(lessons, dateJst) {
  const tutorMap = new Map();

  lessons.forEach(lesson => {
    const tutorName = lesson[1]; // tutor_name column
    const status = lesson[25]; // status column

    if (status === 'ERROR') return; // Skip errors

    if (!tutorMap.has(tutorName)) {
      tutorMap.set(tutorName, {
        lessons: [],
      });
    }

    tutorMap.get(tutorName).lessons.push(lesson);
  });

  const rows = [];

  tutorMap.forEach((data, tutorName) => {
    const lessonsCount = data.lessons.length;
    
    if (lessonsCount === 0) return;

    // Calculate averages
    const avgTalkRatio = data.lessons.reduce((sum, l) => sum + parseFloat(l[7] || 0), 0) / lessonsCount;
    const avgMaxMonologue = data.lessons.reduce((sum, l) => sum + parseInt(l[10] || 0), 0) / lessonsCount;
    const totalInterruptions = data.lessons.reduce((sum, l) => sum + parseInt(l[15] || 0), 0);
    const avgConfusion = data.lessons.reduce((sum, l) => sum + parseFloat(l[17] || 0), 0) / lessonsCount;
    const avgStress = data.lessons.reduce((sum, l) => sum + parseFloat(l[18] || 0), 0) / lessonsCount;

    // Collect all alerts
    const allAlerts = data.lessons
      .map(l => l[25 - 1] || '') // alerts from KPIs (not in lesson row, need to extract from original)
      .filter(a => a)
      .join('; ');

    rows.push([
      dateJst,
      tutorName,
      lessonsCount,
      parseFloat(avgTalkRatio.toFixed(3)),
      Math.round(avgMaxMonologue),
      totalInterruptions,
      parseFloat(avgConfusion.toFixed(3)),
      parseFloat(avgStress.toFixed(3)),
      allAlerts,
    ]);
  });

  return rows;
}

/**
 * Calculate weekly score (0-100)
 * @param {Array} lessons - Weekly lessons for a tutor
 * @returns {Object} { totalScore, breakdown }
 */
export function calculateWeeklyScore(lessons) {
  if (lessons.length === 0) {
    return { totalScore: 0, breakdown: '' };
  }

  // Score components (total 100 points)
  let score = 100;
  const breakdown = [];

  // 1. Talk ratio (max -30 points)
  const avgTalkRatio = lessons.reduce((sum, l) => sum + parseFloat(l[7] || 0), 0) / lessons.length;
  if (avgTalkRatio >= 0.70) {
    score -= 30;
    breakdown.push('発話比率高(-30)');
  } else if (avgTalkRatio >= 0.60) {
    score -= 15;
    breakdown.push('発話比率やや高(-15)');
  }

  // 2. Monologues (max -20 points)
  const avgMaxMonologue = lessons.reduce((sum, l) => sum + parseInt(l[10] || 0), 0) / lessons.length;
  if (avgMaxMonologue >= 300) {
    score -= 20;
    breakdown.push('長時間モノローグ(-20)');
  } else if (avgMaxMonologue >= 180) {
    score -= 10;
    breakdown.push('モノローグやや長(-10)');
  }

  // 3. Interruptions (max -15 points)
  const avgInterruptions = lessons.reduce((sum, l) => sum + parseInt(l[15] || 0), 0) / lessons.length;
  if (avgInterruptions >= 5) {
    score -= 15;
    breakdown.push('割り込み頻繁(-15)');
  } else if (avgInterruptions >= 3) {
    score -= 8;
    breakdown.push('割り込みやや多(-8)');
  }

  // 4. Student engagement (max -20 points)
  const avgStudentTurns = lessons.reduce((sum, l) => sum + parseInt(l[13] || 0), 0) / lessons.length;
  if (avgStudentTurns < 10) {
    score -= 20;
    breakdown.push('生徒発話少(-20)');
  } else if (avgStudentTurns < 20) {
    score -= 10;
    breakdown.push('生徒発話やや少(-10)');
  }

  // 5. Confusion/Stress (max -15 points)
  const avgConfusion = lessons.reduce((sum, l) => sum + parseFloat(l[17] || 0), 0) / lessons.length;
  const avgStress = lessons.reduce((sum, l) => sum + parseFloat(l[18] || 0), 0) / lessons.length;
  if (avgConfusion >= 0.3 || avgStress >= 0.3) {
    score -= 15;
    breakdown.push('困惑/ストレス高(-15)');
  } else if (avgConfusion >= 0.2 || avgStress >= 0.2) {
    score -= 8;
    breakdown.push('困惑/ストレスやや高(-8)');
  }

  return {
    totalScore: Math.max(score, 0),
    breakdown: breakdown.join('; ') || '良好',
  };
}
