import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { config, validateConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { sheetsService } from '../services/sheetsService.js';

const app = new Hono();

// Enable CORS
app.use('/api/*', cors());

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

// API Routes

/**
 * Get weekly tutors summary (for charts)
 */
app.get('/api/weekly-summary', async (c) => {
  try {
    await sheetsService.initialize();
    const data = await sheetsService.getSheetData('weekly_tutors');

    if (data.length <= 1) {
      return c.json({ success: true, data: [] });
    }

    const headers = data[0];
    const rows = data.slice(1);

    const summary = rows.map((row) => ({
      week_start: row[headers.indexOf('week_start_jst')],
      week_end: row[headers.indexOf('week_end_jst')],
      tutor_name: row[headers.indexOf('tutor_name')],
      lessons_count: parseInt(row[headers.indexOf('lessons_count')] || 0),
      weekly_score: parseFloat(row[headers.indexOf('weekly_score_total')] || 0),
      score_breakdown: row[headers.indexOf('score_breakdown')],
      key_findings: row[headers.indexOf('weekly_key_findings')],
      actions: row[headers.indexOf('weekly_actions_top3')],
    }));

    return c.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Failed to get weekly summary', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * Get daily lessons (for dropdown selection)
 */
app.get('/api/lessons', async (c) => {
  try {
    await sheetsService.initialize();
    const data = await sheetsService.getSheetData('daily_lessons');

    if (data.length <= 1) {
      return c.json({ success: true, data: [] });
    }

    const headers = data[0];
    const rows = data.slice(1);

    // Filter out ERROR rows
    const lessons = rows
      .filter((row) => row[headers.indexOf('status')] === 'OK')
      .map((row) => ({
        date: row[headers.indexOf('date_jst')],
        tutor_name: row[headers.indexOf('tutor_name')],
        file_id: row[headers.indexOf('drive_file_id')],
        file_name: row[headers.indexOf('drive_file_name')],
        duration_sec: parseInt(row[headers.indexOf('duration_sec')] || 0),
        talk_ratio_tutor: parseFloat(row[headers.indexOf('talk_ratio_tutor')] || 0),
        max_monologue_sec: parseInt(row[headers.indexOf('max_tutor_monologue_sec')] || 0),
        student_turns: parseInt(row[headers.indexOf('student_turns')] || 0),
        confusion_ratio: parseFloat(row[headers.indexOf('confusion_ratio_est')] || 0),
        stress_ratio: parseFloat(row[headers.indexOf('stress_ratio_est')] || 0),
        positive_ratio: parseFloat(row[headers.indexOf('positive_ratio_est')] || 0),
        confusion_top3: row[headers.indexOf('confusion_top3')],
        stress_top3: row[headers.indexOf('stress_top3')],
        positive_top3: row[headers.indexOf('positive_top3')],
        improvement_advice: row[headers.indexOf('improvement_advice')],
        recommended_actions: row[headers.indexOf('recommended_actions')],
      }));

    return c.json({ success: true, data: lessons });
  } catch (error) {
    logger.error('Failed to get lessons', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * Get lesson detail by file_id
 */
app.get('/api/lessons/:fileId', async (c) => {
  try {
    const fileId = c.req.param('fileId');

    await sheetsService.initialize();
    const data = await sheetsService.getSheetData('daily_lessons');

    if (data.length <= 1) {
      return c.json({ success: false, error: 'No lessons found' }, 404);
    }

    const headers = data[0];
    const fileIdIndex = headers.indexOf('drive_file_id');

    const row = data.slice(1).find((r) => r[fileIdIndex] === fileId);

    if (!row) {
      return c.json({ success: false, error: 'Lesson not found' }, 404);
    }

    const lesson = {
      date: row[headers.indexOf('date_jst')],
      tutor_name: row[headers.indexOf('tutor_name')],
      file_id: row[fileIdIndex],
      file_name: row[headers.indexOf('drive_file_name')],
      duration_sec: parseInt(row[headers.indexOf('duration_sec')] || 0),
      talk_ratio_tutor: parseFloat(row[headers.indexOf('talk_ratio_tutor')] || 0),
      tutor_speaking_sec: parseInt(row[headers.indexOf('tutor_speaking_sec')] || 0),
      student_speaking_sec: parseInt(row[headers.indexOf('student_speaking_sec')] || 0),
      max_monologue_sec: parseInt(row[headers.indexOf('max_tutor_monologue_sec')] || 0),
      monologue_over_3min: parseInt(row[headers.indexOf('monologue_over_3min_count')] || 0),
      monologue_over_5min: parseInt(row[headers.indexOf('monologue_over_5min_count')] || 0),
      student_turns: parseInt(row[headers.indexOf('student_turns')] || 0),
      student_silence_over_15s: parseInt(
        row[headers.indexOf('student_silence_over_15s_count')] || 0
      ),
      interruptions_tutor: parseInt(
        row[headers.indexOf('interruptions_tutor_over_student')] || 0
      ),
      interruptions_student: parseInt(
        row[headers.indexOf('interruptions_student_over_tutor')] || 0
      ),
      confusion_ratio: parseFloat(row[headers.indexOf('confusion_ratio_est')] || 0),
      stress_ratio: parseFloat(row[headers.indexOf('stress_ratio_est')] || 0),
      positive_ratio: parseFloat(row[headers.indexOf('positive_ratio_est')] || 0),
      confusion_top3: row[headers.indexOf('confusion_top3')],
      stress_top3: row[headers.indexOf('stress_top3')],
      positive_top3: row[headers.indexOf('positive_top3')],
      improvement_advice: row[headers.indexOf('improvement_advice')],
      recommended_actions: row[headers.indexOf('recommended_actions')],
    };

    return c.json({ success: true, data: lesson });
  } catch (error) {
    logger.error('Failed to get lesson detail', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Home page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WannaV レッスン分析ダッシュボード</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- Header -->
            <header class="bg-white shadow">
                <div class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                    <h1 class="text-3xl font-bold text-gray-900">
                        📊 WannaV レッスン分析ダッシュボード
                    </h1>
                </div>
            </header>

            <!-- Main Content -->
            <main class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                
                <!-- Weekly Summary Section -->
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">📈 週次評価</h2>
                    
                    <!-- Charts Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <!-- Score Chart -->
                        <div class="bg-white rounded-lg shadow p-6">
                            <h3 class="text-lg font-semibold mb-4">週次スコア推移</h3>
                            <canvas id="scoreChart"></canvas>
                        </div>

                        <!-- Lessons Count Chart -->
                        <div class="bg-white rounded-lg shadow p-6">
                            <h3 class="text-lg font-semibold mb-4">レッスン数推移</h3>
                            <canvas id="lessonsChart"></canvas>
                        </div>
                    </div>

                    <!-- Weekly Summary Table -->
                    <div class="bg-white rounded-lg shadow overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-200">
                            <h3 class="text-lg font-semibold">週次サマリー</h3>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">週</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">講師</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">レッスン数</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">スコア</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">主要所見</th>
                                    </tr>
                                </thead>
                                <tbody id="weeklySummaryTable" class="bg-white divide-y divide-gray-200">
                                    <!-- Populated by JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Lesson Detail Section -->
                <div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">🎥 レッスン詳細</h2>
                    
                    <!-- Lesson Selector -->
                    <div class="bg-white rounded-lg shadow p-6 mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            レッスンを選択
                        </label>
                        <select id="lessonSelector" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="">選択してください...</option>
                        </select>
                    </div>

                    <!-- Lesson Detail Card -->
                    <div id="lessonDetail" class="hidden">
                        <!-- Populated by JS -->
                    </div>
                </div>
            </main>
        </div>

        <script src="/static/js/dashboard.js"></script>
    </body>
    </html>
  `);
});

// Start server
async function startServer() {
  try {
    validateConfig();
    logger.info('Starting dashboard server...');

    serve(
      {
        fetch: app.fetch,
        port: config.dashboardPort,
        hostname: config.dashboardHost,
      },
      (info) => {
        logger.info(`Dashboard server running at http://${info.address}:${info.port}`);
      }
    );
  } catch (error) {
    logger.error('Failed to start dashboard server', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;
