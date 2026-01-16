// Dashboard JavaScript

let talkRatioChart = null;
let lessonsChart = null;
let selectedTutor = ''; // Track selected tutor

// Initialize dashboard
async function initDashboard() {
  try {
    // Load tutors list
    await loadTutors();

    // Load monthly summary
    await loadMonthlySummary();

    // Load lessons for dropdown
    await loadLessons();

    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
    alert('ダッシュボードの初期化に失敗しました');
  }
}

// Load tutors list
async function loadTutors() {
  try {
    const response = await axios.get('/api/tutors');
    const { data } = response.data;

    const selector = document.getElementById('tutorSelector');

    const options = data.map(
      (tutorName) => `<option value="${tutorName}">${tutorName}</option>`
    );

    selector.innerHTML = '<option value="">全講師</option>' + options.join('');
  } catch (error) {
    console.error('Failed to load tutors:', error);
  }
}

// Load monthly summary data
async function loadMonthlySummary() {
  try {
    const response = await axios.get('/api/monthly-summary');
    let { data } = response.data;

    // Filter by selected tutor if applicable
    if (selectedTutor) {
      data = data.filter(item => item.tutor_name === selectedTutor);
    }

    if (data.length === 0) {
      document.getElementById('monthlySummaryTable').innerHTML =
        '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">データがありません</td></tr>';
      
      // Clear charts
      if (talkRatioChart) {
        talkRatioChart.destroy();
        talkRatioChart = null;
      }
      if (lessonsChart) {
        lessonsChart.destroy();
        lessonsChart = null;
      }
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
    renderTalkRatioChart(tutorData);
    renderLessonsChart(tutorData);

    // Render table
    renderMonthlySummaryTable(data);
  } catch (error) {
    console.error('Failed to load monthly summary:', error);
  }
}

// Render talk ratio chart
function renderTalkRatioChart(tutorData) {
  const ctx = document.getElementById('talkRatioChart').getContext('2d');

  // Destroy existing chart
  if (talkRatioChart) {
    talkRatioChart.destroy();
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
    const tutorMonths = tutorData[tutorName].sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    return {
      label: tutorName,
      data: tutorMonths.map((m) => (m.avg_tutor_talk_ratio * 100).toFixed(1)),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
      tension: 0.3,
    };
  });

  // Get all unique months (sorted)
  const allMonths = [
    ...new Set(
      Object.values(tutorData)
        .flat()
        .map((m) => m.month)
    ),
  ].sort();

  talkRatioChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allMonths,
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
            text: '講師発話比率 (%)',
          },
        },
        x: {
          title: {
            display: true,
            text: '月',
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
    const tutorMonths = tutorData[tutorName].sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    return {
      label: tutorName,
      data: tutorMonths.map((m) => m.lessons_count),
      backgroundColor: colors[index % colors.length],
    };
  });

  // Get all unique months
  const allMonths = [
    ...new Set(
      Object.values(tutorData)
        .flat()
        .map((m) => m.month)
    ),
  ].sort();

  lessonsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allMonths,
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
            text: '月',
          },
        },
      },
    },
  });
}

// Render monthly summary table
function renderMonthlySummaryTable(data) {
  const tableBody = document.getElementById('monthlySummaryTable');

  // Sort by month (descending)
  const sortedData = data.sort((a, b) => b.month.localeCompare(a.month));

  const rows = sortedData
    .map((item) => {
      const talkRatioPercent = (item.avg_tutor_talk_ratio * 100).toFixed(1);
      const ratioColor = item.avg_tutor_talk_ratio <= 0.6 ? 'text-green-600' : item.avg_tutor_talk_ratio <= 0.7 ? 'text-yellow-600' : 'text-red-600';

      return `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.month}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.tutor_name}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.lessons_count}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${ratioColor}">
          ${talkRatioPercent}%
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.avg_silence_15s_count.toFixed(1)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.total_duration_min.toFixed(0)}分
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
    // Build URL with tutor filter if selected
    let url = '/api/lessons';
    if (selectedTutor) {
      url += `?tutor=${encodeURIComponent(selectedTutor)}`;
    }

    const response = await axios.get(url);
    const { data } = response.data;

    const selector = document.getElementById('lessonSelector');

    // Sort by month (descending)
    const sortedLessons = data.sort((a, b) => b.month.localeCompare(a.month));

    // Extract student name from file name
    const extractStudentName = (fileName) => {
      // Format: "WannaVレッスン予約 (福田京華) - 2026/01/11 08:55 JST～Recording"
      const match = fileName.match(/\((.+?)\)/);
      return match ? match[1] : '不明';
    };

    const options = sortedLessons.map((lesson) => {
      const studentName = extractStudentName(lesson.file_name);
      const displayText = `${lesson.month}_${studentName}`;
      
      return `
        <option value="${lesson.file_id}">
          ${displayText}
        </option>
      `;
    });

    selector.innerHTML = '<option value="">選択してください...</option>' + options.join('');
    
    // Hide lesson detail when lessons change
    document.getElementById('lessonDetail').classList.add('hidden');
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
            ${lesson.month} | ${lesson.tutor_name} | ${Math.floor(lesson.duration_sec / 60)}分${lesson.duration_sec % 60}秒
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
  // Tutor selector
  const tutorSelector = document.getElementById('tutorSelector');
  tutorSelector.addEventListener('change', async (e) => {
    selectedTutor = e.target.value;
    
    // Reload data with new filter
    await loadMonthlySummary();
    await loadLessons();
  });

  // Lesson selector
  const lessonSelector = document.getElementById('lessonSelector');
  lessonSelector.addEventListener('change', (e) => {
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
