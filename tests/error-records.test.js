import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const marker = 'SYNTHETIC_EXCEPTION_CREDENTIAL_AND_PERSON_MARKER';
const fail = async () => { throw Object.assign(new Error(marker), { response: { data: marker } }); };
const logger = new Proxy({}, { get: () => () => {} });
let sequence = 0;
// Load unchanged service bodies, replacing only imports. No env loading, network or jobs.
async function load(path, dependencies) {
  let source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const names = Object.keys(dependencies);
  const key = `speechErrorRecords${sequence++}`;
  globalThis[key] = dependencies;
  source = source.replace(/^import .*;\r?$/gm, '');
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(`const {${names.join(',')}} = globalThis[${JSON.stringify(key)}];\n${source}`).toString('base64')}`);
  } finally { delete globalThis[key]; }
}
async function formatters() {
  return load('src/utils/sheetFormatters.js', { toJSTString: value => value });
}
const lesson = {
  tutorName: 'Fixture tutor', folderUrl: 'https://example.invalid/folder',
  dateJst: '2026-10-26', file: { id: 'fixture-file', name: 'fixture.mp4', createdTime: 'fixture-time' }
};
function privateOutput(value) { assert.equal(JSON.stringify(value).includes(marker), false); }

test('real lesson service returns fixed failure rows and retains 27-column schema', async () => {
  const formats = await formatters();
  const { processLesson, processTutorFolder } = await load('src/services/lessonProcessor.js', {
    logger, driveService: { downloadFile: fail, extractFolderId: () => 'fixture', listVideosInFolder: fail },
    audioService: {}, transcriptionService: {}, analyzeLessonKPIs: () => {}, emotionAnalyzer: {},
    ...formats, unlinkSync: () => { throw new Error('unexpected cleanup'); }
  });
  const result = await processLesson(lesson);
  assert.equal(result.success, false);
  assert.equal(result.row.length, formats.DAILY_LESSONS_HEADERS.length);
  assert.equal(result.row[25], 'ERROR');
  assert.equal(result.row[26], 'Lesson processing failed');
  assert.deepEqual(result.row.slice(0, 6), [lesson.dateJst, lesson.tutorName, lesson.folderUrl, 'fixture-file', 'fixture.mp4', 'fixture-time']);
  privateOutput(result);
  const folder = await processTutorFolder({ ...lesson, processedFileIds: new Set() });
  assert.equal(folder.length, 1);
  assert.equal(folder[0].length, 27);
  assert.equal(folder[0][25], 'ERROR');
  assert.equal(folder[0][26], 'Folder access failed');
  privateOutput(folder);
});

test('real lesson normal result and skip-processing metadata remain unchanged', async () => {
  const formats = await formatters();
  const kpis = { talkRatioTutor: 0.5, tutorSpeakingMs: 1000, studentSpeakingMs: 1000, maxTutorMonologueMs: 1000 };
  const { processLesson, processTutorFolder } = await load('src/services/lessonProcessor.js', {
    logger, driveService: { downloadFile: async () => 'fixture-video', extractFolderId: () => 'fixture', listVideosInFolder: async () => [lesson.file] },
    audioService: { processVideo: async () => ({ audioPath: 'fixture-audio', duration: 2 }) },
    transcriptionService: { transcribeAndDiarize: async () => ({ utterances: [{}] }) },
    analyzeLessonKPIs: () => kpis,
    emotionAnalyzer: { analyzeEmotionalSignals: async () => ({}), generateReport: async () => ({ improvementAdvice: 'fixture advice', recommendedActions: 'fixture action' }) },
    ...formats, unlinkSync: () => {}
  });
  const result = await processLesson(lesson);
  assert.equal(result.success, true);
  assert.equal(result.row[25], 'OK');
  assert.equal(result.row[26], '');
  assert.equal(result.row[23], 'fixture advice');
  assert.deepEqual(await processTutorFolder({ ...lesson, processedFileIds: new Set(), skipProcessing: true }),
    [{ fileId: 'fixture-file', fileName: 'fixture.mp4', createdTime: 'fixture-time' }]);
});

test('real sales service keeps failed result and report structures without exception text', async () => {
  const { salesEvaluationService: service } = await load('src/services/salesEvaluationService.js', {
    logger, driveService: {}, audioService: { initialize: fail }, transcriptionService: {}, emotionAnalyzer: {},
    geminiService: { genAI: { getGenerativeModel: () => ({ generateContent: fail }) } }
  });
  const result = await service.analyzeSalesCall({ subfolder: { name: 'fixture' }, parentFolderUrl: 'fixture-url', personName: 'fixture-person', videoFile: lesson.file, monthStr: '2026-10' });
  assert.equal(result.success, false);
  assert.equal(result.error, 'Sales call analysis failed');
  assert.equal(result.fileId, 'fixture-file');
  privateOutput(result);
  const report = await service.generateSalesReport({ talk_ratio_sales: 0.5, talk_ratio_customer: 0.5 }, { confusion_ratio_est: 0, stress_ratio_est: 0, positive_ratio_est: 0 });
  assert.equal(report.listening, 'レポート生成中にエラーが発生しました');
  assert.deepEqual(report.improvements, []);
  assert.deepEqual(Object.keys(report), ['listening', 'questioning', 'explanation', 'customer_experience', 'improvements']);
  privateOutput(report);
});

test('real sales job formats subfolder failures into fixed 25-column sheet rows', async () => {
  const written = [];
  const { runSalesEvaluation, SALES_EVALUATIONS_HEADERS } = await load('src/jobs/salesEvaluation.js', {
    logger, config: {}, validateConfig: () => {},
    driveService: { initialize: async () => {}, extractFolderId: () => 'fixture' },
    sheetsService: { initialize: async () => {}, getSheetData: async () => [['name', 'url', 'person'], ['fixture', 'fixture-url', 'fixture-person']], getOrCreateSheet: async () => {}, writeHeaders: async () => {}, appendRows: async (sheet, rows) => written.push(...rows) },
    salesEvaluationService: { listSubfolders: async () => [{ id: 'fixture', name: 'fixture-subfolder' }], listVideosInCurrentMonth: fail }
  });
  await runSalesEvaluation('2026-10');
  assert.equal(written.length, 1);
  assert.equal(written[0].length, SALES_EVALUATIONS_HEADERS.length);
  assert.equal(written[0].length, 25);
  assert.equal(written[0][22], 'ERROR');
  assert.equal(written[0][23], 'Sales subfolder processing failed');
  assert.equal(written[0][24], 'fixture-person');
  privateOutput(written);
});
