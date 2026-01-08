// Dashboard JavaScript

let scoreChart = null;
let lessonsChart = null;

// Initialize dashboard
async function initDashboard() {
  try {
    // Load weekly summary
    await loadWeeklySummary();

    // Load lessons for dropdown
    await loadLessons();

    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
    alert('ダッシュボードの初期化に失敗しました');
  }
}

// Load weekly summary data
async function loadWeeklySummary() {
  try {
    const response = await axios.get('/api/weekly-summary');
    const { data } = response.data;

    if (data.length === 0) {
      document.getElementById('weeklySummaryTable').innerHTML =
        '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">データがありません</td></tr>';
      return;
    }

    // Group by tutor
    const tutorData = {};
    data.forEach((item) => {
      if (!tutorData[item.tutor_name]) {
        tutorData[item.tutor_name] = [];
      }
      tutorData[item.tutor_name].push(item);
    });

    // Render charts
    renderScoreChart(tutorData);
    renderLessonsChart(tutorData);

    // Render table
    renderWeeklySummaryTable(data);
  } catch (error) {
    console.error('Failed to load weekly summary:', error);
  }
}

// Render score chart
function renderScoreChart(tutorData) {
  const ctx = document.getElementById('scoreChart').getContext('2d');

  // Destroy existing chart
  if (scoreChart) {
    scoreChart.destroy();
  }

  // Prepare datasets
  const colors = [
    'rgb(59, 130, 246)', // blue
    'rgb(34, 197, 94)', // green
    'rgb(249, 115, 22)', // orange
    'rgb(236, 72, 153)', // pink
    'rgb(168, 85, 247)', // purple
  ];

  const datasets = Object.keys(tutorData).map((tutorName, index) => {
    const tutorWeeks = tutorData[tutorName].sort((a, b) =>
      a.week_start.localeCompare(b.week_start)
    );

    return {
      label: tutorName,
      data: tutorWeeks.map((w) => w.weekly_score),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
      tension: 0.3,
    };
  });

  // Get all unique weeks (sorted)
  const allWeeks = [
    ...new Set(
      Object.values(tutorData)
        .flat()
        .map((w) => w.week_start)
    ),
  ].sort();

  scoreChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allWeeks,
      datasets: datasets,
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'スコア',
          },
        },
        x: {
          title: {
            display: true,
            text: '週',
          },
        },
      },
    },
  });
}

// Render lessons count chart
function renderLessonsChart(tutorData) {
  const ctx = document.getElementById('lessonsChart').getContext('2d');

  // Destroy existing chart
  if (lessonsChart) {
    lessonsChart.destroy();
  }

  // Prepare datasets
  const colors = [
    'rgb(59, 130, 246)',
    'rgb(34, 197, 94)',
    'rgb(249, 115, 22)',
    'rgb(236, 72, 153)',
    'rgb(168, 85, 247)',
  ];

  const datasets = Object.keys(tutorData).map((tutorName, index) => {
    const tutorWeeks = tutorData[tutorName].sort((a, b) =>
      a.week_start.localeCompare(b.week_start)
    );

    return {
      label: tutorName,
      data: tutorWeeks.map((w) => w.lessons_count),
      backgroundColor: colors[index % colors.length],
    };
  });

  // Get all unique weeks
  const allWeeks = [
    ...new Set(
      Object.values(tutorData)
        .flat()
        .map((w) => w.week_start)
    ),
  ].sort();

  lessonsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allWeeks,
      datasets: datasets,
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'レッスン数',
          },
        },
        x: {
          title: {
            display: true,
            text: '週',
          },
        },
      },
    },
  });
}

// Render weekly summary table
function renderWeeklySummaryTable(data) {
  const tableBody = document.getElementById('weeklySummaryTable');

  // Sort by week (descending)
  const sortedData = data.sort((a, b) => b.week_start.localeCompare(a.week_start));

  const rows = sortedData
    .map((item) => {
      const scoreColor = item.weekly_score >= 80 ? 'text-green-600' : item.weekly_score >= 60 ? 'text-yellow-600' : 'text-red-600';

      return `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.week_start} 〜 ${item.week_end}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.tutor_name}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.lessons_count}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${scoreColor}">
          ${item.weekly_score} / 100
        </td>
        <td class="px-6 py-4 text-sm text-gray-700">
          ${item.key_findings || '-'}
        </td>
      </tr>
    `;
    })
    .join('');

  tableBody.innerHTML = rows;
}

// Load lessons for dropdown
async function loadLessons() {
  try {
    const response = await axios.get('/api/lessons');
    const { data } = response.data;

    const selector = document.getElementById('lessonSelector');

    // Sort by date (descending)
    const sortedLessons = data.sort((a, b) => b.date.localeCompare(a.date));

    const options = sortedLessons.map(
      (lesson) => `
      <option value="${lesson.file_id}">
        ${lesson.date} - ${lesson.tutor_name} - ${lesson.file_name}
      </option>
    `
    );

    selector.innerHTML = '<option value="">選択してください...</option>' + options.join('');
  } catch (error) {
    console.error('Failed to load lessons:', error);
  }
}

// Load and display lesson detail
async function loadLessonDetail(fileId) {
  try {
    const response = await axios.get(`/api/lessons/${fileId}`);
    const { data: lesson } = response.data;

    const detailDiv = document.getElementById('lessonDetail');

    // Calculate percentages
    const tutorPercent = (lesson.talk_ratio_tutor * 100).toFixed(1);
    const studentPercent = ((1 - lesson.talk_ratio_tutor) * 100).toFixed(1);

    const html = `
      <div class="bg-white rounded-lg shadow">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 class="text-xl font-semibold">${lesson.file_name}</h3>
          <p class="text-sm text-gray-600 mt-1">
            ${lesson.date} | ${lesson.tutor_name} | ${Math.floor(lesson.duration_sec / 60)}分${lesson.duration_sec % 60}秒
          </p>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
          <!-- KPI Grid -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-blue-50 rounded-lg p-4">
              <div class="text-sm text-gray-600">講師発話比率</div>
              <div class="text-2xl font-bold text-blue-600">${tutorPercent}%</div>
            </div>
            <div class="bg-green-50 rounded-lg p-4">
              <div class="text-sm text-gray-600">生徒発話比率</div>
              <div class="text-2xl font-bold text-green-600">${studentPercent}%</div>
            </div>
            <div class="bg-yellow-50 rounded-lg p-4">
              <div class="text-sm text-gray-600">最長モノローグ</div>
              <div class="text-2xl font-bold text-yellow-600">${Math.floor(lesson.max_monologue_sec / 60)}分</div>
            </div>
            <div class="bg-purple-50 rounded-lg p-4">
              <div class="text-sm text-gray-600">生徒ターン数</div>
              <div class="text-2xl font-bold text-purple-600">${lesson.student_turns}回</div>
            </div>
          </div>

          <!-- Emotional Signals -->
          <div>
            <h4 class="text-lg font-semibold mb-3">感情シグナル</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="border border-red-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium text-red-700">困惑</span>
                  <span class="text-sm text-red-600">${(lesson.confusion_ratio * 100).toFixed(1)}%</span>
                </div>
                <div class="text-sm text-gray-700 whitespace-pre-line">
                  ${lesson.confusion_top3 || 'なし'}
                </div>
              </div>
              <div class="border border-orange-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium text-orange-700">ストレス</span>
                  <span class="text-sm text-orange-600">${(lesson.stress_ratio * 100).toFixed(1)}%</span>
                </div>
                <div class="text-sm text-gray-700 whitespace-pre-line">
                  ${lesson.stress_top3 || 'なし'}
                </div>
              </div>
              <div class="border border-green-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium text-green-700">ポジティブ</span>
                  <span class="text-sm text-green-600">${(lesson.positive_ratio * 100).toFixed(1)}%</span>
                </div>
                <div class="text-sm text-gray-700 whitespace-pre-line">
                  ${lesson.positive_top3 || 'なし'}
                </div>
              </div>
            </div>
          </div>

          <!-- Improvement Advice -->
          <div>
            <h4 class="text-lg font-semibold mb-3">改善アドバイス</h4>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p class="text-gray-800">${lesson.improvement_advice}</p>
            </div>
          </div>

          <!-- Recommended Actions -->
          <div>
            <h4 class="text-lg font-semibold mb-3">推奨アクション</h4>
            <div class="space-y-2">
              ${lesson.recommended_actions
                .split('\n')
                .filter((a) => a.trim())
                .map(
                  (action, index) => `
                <div class="flex items-start">
                  <span class="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">
                    ${index + 1}
                  </span>
                  <p class="text-gray-800">${action}</p>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- Additional Stats -->
          <div>
            <h4 class="text-lg font-semibold mb-3">詳細統計</h4>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span class="text-gray-600">講師発話時間:</span>
                <span class="font-medium ml-2">${Math.floor(lesson.tutor_speaking_sec / 60)}分${lesson.tutor_speaking_sec % 60}秒</span>
              </div>
              <div>
                <span class="text-gray-600">生徒発話時間:</span>
                <span class="font-medium ml-2">${Math.floor(lesson.student_speaking_sec / 60)}分${lesson.student_speaking_sec % 60}秒</span>
              </div>
              <div>
                <span class="text-gray-600">3分超モノローグ:</span>
                <span class="font-medium ml-2">${lesson.monologue_over_3min}回</span>
              </div>
              <div>
                <span class="text-gray-600">5分超モノローグ:</span>
                <span class="font-medium ml-2">${lesson.monologue_over_5min}回</span>
              </div>
              <div>
                <span class="text-gray-600">15秒超沈黙:</span>
                <span class="font-medium ml-2">${lesson.student_silence_over_15s}回</span>
              </div>
              <div>
                <span class="text-gray-600">講師→生徒割込:</span>
                <span class="font-medium ml-2">${lesson.interruptions_tutor}回</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    detailDiv.innerHTML = html;
    detailDiv.classList.remove('hidden');
  } catch (error) {
    console.error('Failed to load lesson detail:', error);
    alert('レッスン詳細の読み込みに失敗しました');
  }
}

// Setup event listeners
function setupEventListeners() {
  const selector = document.getElementById('lessonSelector');

  selector.addEventListener('change', (e) => {
    const fileId = e.target.value;

    if (fileId) {
      loadLessonDetail(fileId);
    } else {
      document.getElementById('lessonDetail').classList.add('hidden');
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initDashboard);
