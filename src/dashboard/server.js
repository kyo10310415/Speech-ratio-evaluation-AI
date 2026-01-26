import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { config, validateConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { sheetsService } from '../services/sheetsService.js';
import { jobScheduler } from '../scheduler/jobScheduler.js';

const app = new Hono();

// Enable CORS
app.use('/api/*', cors());

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

// Serve manual.html
app.get('/manual.html', serveStatic({ path: './public/manual.html' }));

// API Routes

/**
 * Get list of tutors from 新フォルダURL sheet
 */
app.get('/api/tutors', async (c) => {
  try {
    await sheetsService.initialize();
    const data = await sheetsService.getSheetData('新フォルダURL');

    if (data.length <= 1) {
      return c.json({ success: true, data: [] });
    }

    // Get tutor names from A column (skip header)
    const tutorNames = data.slice(1)
      .map(row => row[0]) // A column
      .filter(name => name && name.trim() !== '')
      .sort(); // Sort alphabetically

    // Remove duplicates
    const uniqueTutors = [...new Set(tutorNames)];

    return c.json({ success: true, data: uniqueTutors });
  } catch (error) {
    logger.error('Failed to get tutors list', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * Get monthly tutors summary (for charts)
 */
app.get('/api/monthly-summary', async (c) => {
  try {
    await sheetsService.initialize();
    const data = await sheetsService.getSheetData('monthly_tutors');

    if (data.length <= 1) {
      return c.json({ success: true, data: [] });
    }

    const headers = data[0];
    const rows = data.slice(1);

    const summary = rows.map((row) => ({
      month: row[headers.indexOf('date_jst')], // 2026-01 format
      tutor_name: row[headers.indexOf('tutor_name')],
      lessons_count: parseInt(row[headers.indexOf('lessons_count')] || 0),
      avg_talk_ratio: parseFloat(row[headers.indexOf('avg_talk_ratio_tutor')] || 0),
      avg_monologue_sec: parseFloat(row[headers.indexOf('avg_max_tutor_monologue_sec')] || 0),
      avg_confusion_ratio: parseFloat(row[headers.indexOf('avg_confusion_ratio_est')] || 0),
    }));

    return c.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Failed to get monthly summary', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * Get sales evaluations summary
 */
app.get('/api/sales-summary', async (c) => {
  try {
    await sheetsService.initialize();
    const data = await sheetsService.getSheetData('sales_evaluations');

    if (data.length <= 1) {
      return c.json({ success: true, data: [] });
    }

    const headers = data[0];
    const rows = data.slice(1);

    const summary = rows
      .filter((row) => row[headers.indexOf('status')] === 'OK') // Filter out errors
      .map((row) => ({
        month: row[headers.indexOf('month')],
        subfolder_name: row[headers.indexOf('subfolder_name')],
        file_id: row[headers.indexOf('file_id')],
        file_name: row[headers.indexOf('file_name')],
        duration_sec: parseInt(row[headers.indexOf('duration_sec')] || 0),
        talk_ratio_sales: parseFloat(row[headers.indexOf('talk_ratio_sales')] || 0),
        talk_ratio_customer: parseFloat(row[headers.indexOf('talk_ratio_customer')] || 0),
        questions_asked: parseInt(row[headers.indexOf('questions_asked')] || 0),
        max_sales_monologue_sec: parseInt(row[headers.indexOf('max_sales_monologue_sec')] || 0),
        confusion_ratio: parseFloat(row[headers.indexOf('confusion_ratio_est')] || 0),
        stress_ratio: parseFloat(row[headers.indexOf('stress_ratio_est')] || 0),
        positive_ratio: parseFloat(row[headers.indexOf('positive_ratio_est')] || 0),
        listening_advice: row[headers.indexOf('listening_advice')],
        questioning_advice: row[headers.indexOf('questioning_advice')],
        explanation_advice: row[headers.indexOf('explanation_advice')],
        customer_experience: row[headers.indexOf('customer_experience')],
        improvements: row[headers.indexOf('improvements')],
      }));

    return c.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Failed to get sales summary', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * Get monthly lessons (for dropdown selection)
 * Optional query param: tutor - filter by tutor name
 */
app.get('/api/lessons', async (c) => {
  try {
    const tutorFilter = c.req.query('tutor');

    await sheetsService.initialize();
    const data = await sheetsService.getSheetData('monthly_lessons');

    if (data.length <= 1) {
      return c.json({ success: true, data: [] });
    }

    const headers = data[0];
    const rows = data.slice(1);

    // Filter out ERROR rows and apply tutor filter if provided
    const lessons = rows
      .filter((row) => {
        const isOk = row[headers.indexOf('status')] === 'OK';
        if (!tutorFilter) return isOk;
        
        const tutorName = row[headers.indexOf('tutor_name')];
        return isOk && tutorName === tutorFilter;
      })
      .map((row) => ({
        month: row[headers.indexOf('date_jst')], // Changed from date to month
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
    const data = await sheetsService.getSheetData('monthly_lessons');

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
      month: row[headers.indexOf('date_jst')], // Changed from date to month
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
                <div class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
                    <div class="flex items-center space-x-8">
                        <h1 class="text-3xl font-bold text-gray-900">
                            📊 WannaV レッスン分析ダッシュボード
                        </h1>
                        <nav class="flex space-x-4">
                            <a href="/" class="px-3 py-2 text-blue-600 border-b-2 border-blue-600 font-medium">
                                月次評価
                            </a>
                            <a href="/sales" class="px-3 py-2 text-gray-600 hover:text-gray-900">
                                セールスチーム
                            </a>
                        </nav>
                    </div>
                    <a href="/manual.html" target="_blank" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        📖 ユーザーマニュアル
                    </a>
                </div>
            </header>

            <!-- Main Content -->
            <main class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                
                <!-- Tutor Filter Section -->
                <div class="mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            講師を選択
                        </label>
                        <select id="tutorSelector" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="">全講師</option>
                        </select>
                    </div>
                </div>
                
                <!-- Monthly Summary Section -->
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">📈 月次評価</h2>
                    
                    <!-- Charts Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <!-- Talk Ratio Chart -->
                        <div class="bg-white rounded-lg shadow p-6">
                            <h3 class="text-lg font-semibold mb-4">講師発話比率 推移</h3>
                            <canvas id="talkRatioChart"></canvas>
                        </div>

                        <!-- Lessons Count Chart -->
                        <div class="bg-white rounded-lg shadow p-6">
                            <h3 class="text-lg font-semibold mb-4">レッスン数推移</h3>
                            <canvas id="lessonsChart"></canvas>
                        </div>
                    </div>

                    <!-- Monthly Summary Table -->
                    <div class="bg-white rounded-lg shadow overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-200">
                            <h3 class="text-lg font-semibold">月次サマリー</h3>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">月</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">講師</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">レッスン数</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="講師の発話時間 / 全体時間">
                                            平均発話比率
                                            <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                                        </th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="講師が連続して話した最長時間（秒）">
                                            平均モノローグ時間
                                            <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                                        </th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="生徒が混乱している可能性の割合">
                                            平均混乱率
                                            <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody id="monthlySummaryTable" class="bg-white divide-y divide-gray-200">
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

// Sales page
app.get('/sales', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>セールスチーム評価 - WannaV</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- Header -->
            <header class="bg-white shadow">
                <div class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
                    <div class="flex items-center space-x-8">
                        <h1 class="text-3xl font-bold text-gray-900">
                            💼 セールスチーム評価
                        </h1>
                        <nav class="flex space-x-4">
                            <a href="/" class="px-3 py-2 text-gray-600 hover:text-gray-900">
                                月次評価
                            </a>
                            <a href="/sales" class="px-3 py-2 text-blue-600 border-b-2 border-blue-600 font-medium">
                                セールスチーム
                            </a>
                        </nav>
                    </div>
                    <a href="/manual.html" target="_blank" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        📖 ユーザーマニュアル
                    </a>
                </div>
            </header>

            <!-- Main Content -->
            <main class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                
                <!-- Monthly Summary Section -->
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">📈 月次サマリー</h2>
                    
                    <!-- Charts Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <!-- Talk Ratio Chart -->
                        <div class="bg-white rounded-lg shadow p-6">
                            <h3 class="text-lg font-semibold mb-4">営業担当者発話比率 推移</h3>
                            <canvas id="talkRatioChart"></canvas>
                        </div>

                        <!-- Questions Chart -->
                        <div class="bg-white rounded-lg shadow p-6">
                            <h3 class="text-lg font-semibold mb-4">質問回数推移</h3>
                            <canvas id="questionsChart"></canvas>
                        </div>
                    </div>

                    <!-- Summary Table -->
                    <div class="bg-white rounded-lg shadow overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-200">
                            <h3 class="text-lg font-semibold">評価サマリー</h3>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">月</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">カテゴリ</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="営業担当者の発話比率（理想は40-50%）">
                                            発話比率
                                            <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                                        </th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="顧客への質問回数（多いほど良い）">
                                            質問回数
                                            <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                                        </th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="最長の連続発話時間（短いほど良い）">
                                            最長モノローグ
                                            <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                                        </th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="顧客の混乱度（低いほど良い）">
                                            混乱率
                                            <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody id="salesSummaryTable" class="bg-white divide-y divide-gray-200">
                                    <!-- Populated by JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Call Detail Section -->
                <div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">📞 通話詳細</h2>
                    
                    <!-- Call Selector -->
                    <div class="bg-white rounded-lg shadow p-6 mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            通話を選択
                        </label>
                        <select id="callSelector" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="">選択してください...</option>
                        </select>
                    </div>

                    <!-- Call Detail Card -->
                    <div id="callDetail" class="hidden">
                        <!-- Populated by JS -->
                    </div>
                </div>
            </main>
        </div>

        <script src="/static/js/sales.js"></script>
    </body>
    </html>
  `);
});

// Start server
async function startServer() {
  try {
    validateConfig();
    logger.info('Starting dashboard server...');

    // Start job scheduler
    jobScheduler.start();

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

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      jobScheduler.stop();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server');
      jobScheduler.stop();
      process.exit(0);
    });
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
