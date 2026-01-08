import { logger } from '../utils/logger.js';
import { formatTimestamp } from '../utils/dateUtils.js';

/**
 * Analyze lesson and calculate all KPIs
 * @param {Array} utterances - Array of utterances with speaker_role, start_ms, end_ms, text
 * @param {number} totalDuration - Total duration in seconds
 * @returns {Object} KPI results
 */
export function analyzeLessonKPIs(utterances, totalDuration) {
  logger.info(`Analyzing KPIs for ${utterances.length} utterances`);

  // Separate utterances by speaker
  const tutorUtterances = utterances.filter(u => u.speaker_role === 'Tutor');
  const studentUtterances = utterances.filter(u => u.speaker_role === 'Student');

  // 1. Speaking time and ratio
  const tutorSpeakingMs = tutorUtterances.reduce((sum, u) => sum + (u.end_ms - u.start_ms), 0);
  const studentSpeakingMs = studentUtterances.reduce((sum, u) => sum + (u.end_ms - u.start_ms), 0);
  const totalSpeakingMs = tutorSpeakingMs + studentSpeakingMs;
  const talkRatioTutor = totalSpeakingMs > 0 ? tutorSpeakingMs / totalSpeakingMs : 0;

  // 2. Tutor monologues (連続発話)
  const tutorMonologues = detectMonologues(tutorUtterances, 1000); // 1 second gap tolerance
  const maxTutorMonologueMs = Math.max(...tutorMonologues.map(m => m.duration), 0);
  const monologueOver3MinCount = tutorMonologues.filter(m => m.duration >= 180000).length;
  const monologueOver5MinCount = tutorMonologues.filter(m => m.duration >= 300000).length;

  // 3. Student participation
  const studentTurns = studentUtterances.length;
  const avgStudentTurnMs = studentTurns > 0 ? studentSpeakingMs / studentTurns : 0;

  // 4. Silences (detect gaps between utterances)
  const silences = detectSilences(utterances, 1000); // Gaps > 1 second
  const studentSilenceOver15sCount = silences.filter(s => s.duration >= 15000).length;

  // 5. Interruptions (話者の被せ)
  const interruptions = detectInterruptions(utterances);

  // 6. Generate alerts
  const alerts = [];
  if (talkRatioTutor >= 0.70) {
    alerts.push('TUTOR_TALK_TOO_MUCH');
  } else if (talkRatioTutor >= 0.60) {
    alerts.push('TUTOR_TALK_SLIGHTLY_HIGH');
  }

  if (maxTutorMonologueMs >= 300000) {
    alerts.push('LONG_MONOLOGUE');
  }

  if (interruptions.tutorOverStudent >= 5) {
    alerts.push('FREQUENT_TUTOR_INTERRUPTIONS');
  }

  if (studentSilenceOver15sCount >= 3) {
    alerts.push('FREQUENT_LONG_SILENCES');
  }

  logger.info(`KPI analysis complete. Talk ratio: ${(talkRatioTutor * 100).toFixed(1)}%`);

  return {
    // Speaking time
    tutorSpeakingMs,
    studentSpeakingMs,
    talkRatioTutor: parseFloat(talkRatioTutor.toFixed(3)),

    // Monologues
    maxTutorMonologueMs,
    monologueOver3MinCount,
    monologueOver5MinCount,
    tutorMonologues, // For detailed analysis

    // Student participation
    studentTurns,
    avgStudentTurnMs: Math.round(avgStudentTurnMs),
    studentSilenceOver15sCount,

    // Interruptions
    interruptionsTutorOverStudent: interruptions.tutorOverStudent,
    interruptionsStudentOverTutor: interruptions.studentOverTutor,

    // Alerts
    alerts: alerts.join('; '),
  };
}

/**
 * Detect monologues (連続発話) by merging close utterances
 * @param {Array} utterances 
 * @param {number} gapThreshold - Maximum gap in ms to merge
 * @returns {Array} Monologues with start, end, duration
 */
function detectMonologues(utterances, gapThreshold = 1000) {
  if (utterances.length === 0) return [];

  // Sort by start time
  const sorted = [...utterances].sort((a, b) => a.start_ms - b.start_ms);

  const monologues = [];
  let currentMonologue = {
    start: sorted[0].start_ms,
    end: sorted[0].end_ms,
  };

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].start_ms - currentMonologue.end;

    if (gap <= gapThreshold) {
      // Extend current monologue
      currentMonologue.end = sorted[i].end_ms;
    } else {
      // Save current and start new
      monologues.push({
        ...currentMonologue,
        duration: currentMonologue.end - currentMonologue.start,
      });
      currentMonologue = {
        start: sorted[i].start_ms,
        end: sorted[i].end_ms,
      };
    }
  }

  // Add last monologue
  monologues.push({
    ...currentMonologue,
    duration: currentMonologue.end - currentMonologue.start,
  });

  return monologues;
}

/**
 * Detect silences (沈黙) between utterances
 * @param {Array} utterances 
 * @param {number} minGap - Minimum gap in ms to consider silence
 * @returns {Array} Silences with start, end, duration
 */
function detectSilences(utterances, minGap = 1000) {
  if (utterances.length === 0) return [];

  // Sort by start time
  const sorted = [...utterances].sort((a, b) => a.start_ms - b.start_ms);

  const silences = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].start_ms - sorted[i].end_ms;

    if (gap >= minGap) {
      silences.push({
        start: sorted[i].end_ms,
        end: sorted[i + 1].start_ms,
        duration: gap,
      });
    }
  }

  return silences;
}

/**
 * Detect interruptions (割り込み/被せ)
 * @param {Array} utterances 
 * @returns {Object} { tutorOverStudent, studentOverTutor }
 */
function detectInterruptions(utterances) {
  // Sort by start time
  const sorted = [...utterances].sort((a, b) => a.start_ms - b.start_ms);

  let tutorOverStudent = 0;
  let studentOverTutor = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    // Check if next utterance starts before current ends (overlap)
    const overlap = current.end_ms - next.start_ms;

    if (overlap > 300) { // At least 300ms overlap
      if (current.speaker_role === 'Student' && next.speaker_role === 'Tutor') {
        tutorOverStudent++;
      } else if (current.speaker_role === 'Tutor' && next.speaker_role === 'Student') {
        studentOverTutor++;
      }
    }
  }

  return { tutorOverStudent, studentOverTutor };
}

/**
 * Merge consecutive utterances by same speaker (for export)
 * @param {Array} utterances 
 * @returns {Array} Merged utterances
 */
export function mergeConsecutiveUtterances(utterances) {
  if (utterances.length === 0) return [];

  const sorted = [...utterances].sort((a, b) => a.start_ms - b.start_ms);
  const merged = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].speaker_role === current.speaker_role) {
      // Same speaker, merge
      current.end_ms = sorted[i].end_ms;
      current.text += ' ' + sorted[i].text;
    } else {
      // Different speaker, save and start new
      merged.push(current);
      current = { ...sorted[i] };
    }
  }

  merged.push(current);
  return merged;
}
