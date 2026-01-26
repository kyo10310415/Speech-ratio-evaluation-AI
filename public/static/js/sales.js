// Sales Dashboard JavaScript

let talkRatioChart = null;
let questionsChart = null;
let salesData = [];

// Load sales summary data
async function loadSalesSummary() {
  try {
    const response = await axios.get('/api/sales-summary');
    const { data } = response.data;

    if (!data || data.length === 0) {
      console.log('No sales data available');
      return;
    }

    salesData = data;

    // Render charts
    renderTalkRatioChart(data);
    renderQuestionsChart(data);

    // Render table
    renderSalesSummaryTable(data);

    // Populate call selector
    populateCallSelector(data);
  } catch (error) {
    console.error('Failed to load sales summary:', error);
  }
}

// Render talk ratio chart
function renderTalkRatioChart(data) {
  const ctx = document.getElementById('talkRatioChart').getContext('2d');

  if (talkRatioChart) {
    talkRatioChart.destroy();
  }

  // Group by month and subfolder
  const groupedData = {};
  data.forEach((item) => {
    const key = `${item.month}_${item.subfolder_name}`;
    if (!groupedData[key]) {
      groupedData[key] = {
        month: item.month,
        subfolder: item.subfolder_name,
        talk_ratio: item.talk_ratio_sales * 100,
      };
    }
  });

  const labels = Object.values(groupedData).map(d => `${d.month}\n${d.subfolder}`);
  const ratios = Object.values(groupedData).map(d => d.talk_ratio.toFixed(1));

  talkRatioChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '発話比率 (%)',
          data: ratios,
          backgroundColor: ratios.map(r => {
            const ratio = parseFloat(r);
            if (ratio >= 40 && ratio <= 50) return 'rgba(34, 197, 94, 0.8)'; // Green
            if (ratio >= 30 && ratio < 40) return 'rgba(234, 179, 8, 0.8)'; // Yellow
            if (ratio > 50 && ratio <= 60) return 'rgba(234, 179, 8, 0.8)'; // Yellow
            return 'rgba(239, 68, 68, 0.8)'; // Red
          }),
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false,
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
            text: '発話比率 (%)',
          },
        },
      },
    },
  });
}

// Render questions chart
function renderQuestionsChart(data) {
  const ctx = document.getElementById('questionsChart').getContext('2d');

  if (questionsChart) {
    questionsChart.destroy();
  }

  // Group by month and subfolder
  const groupedData = {};
  data.forEach((item) => {
    const key = `${item.month}_${item.subfolder_name}`;
    if (!groupedData[key]) {
      groupedData[key] = {
        month: item.month,
        subfolder: item.subfolder_name,
        questions: item.questions_asked,
      };
    }
  });

  const labels = Object.values(groupedData).map(d => `${d.month}\n${d.subfolder}`);
  const questions = Object.values(groupedData).map(d => d.questions);

  questionsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '質問回数',
          data: questions,
          backgroundColor: questions.map(q => {
            if (q >= 10) return 'rgba(34, 197, 94, 0.8)'; // Green
            if (q >= 5) return 'rgba(234, 179, 8, 0.8)'; // Yellow
            return 'rgba(239, 68, 68, 0.8)'; // Red
          }),
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '質問回数',
          },
        },
      },
    },
  });
}

// Render sales summary table
function renderSalesSummaryTable(data) {
  const tableBody = document.getElementById('salesSummaryTable');

  const rows = data
    .map((item) => {
      const talkRatioPercent = (item.talk_ratio_sales * 100).toFixed(1);
      const talkRatioColor =
        item.talk_ratio_sales >= 0.4 && item.talk_ratio_sales <= 0.5
          ? 'text-green-600'
          : item.talk_ratio_sales >= 0.3 && item.talk_ratio_sales < 0.4
          ? 'text-yellow-600'
          : item.talk_ratio_sales > 0.5 && item.talk_ratio_sales <= 0.6
          ? 'text-yellow-600'
          : 'text-red-600';

      const questionsColor =
        item.questions_asked >= 10
          ? 'text-green-600'
          : item.questions_asked >= 5
          ? 'text-yellow-600'
          : 'text-red-600';

      const monologueColor =
        item.max_sales_monologue_sec <= 60
          ? 'text-green-600'
          : item.max_sales_monologue_sec <= 120
          ? 'text-yellow-600'
          : 'text-red-600';

      const confusionPercent = (item.confusion_ratio * 100).toFixed(1);
      const confusionColor =
        item.confusion_ratio <= 0.2
          ? 'text-green-600'
          : item.confusion_ratio <= 0.4
          ? 'text-yellow-600'
          : 'text-red-600';

      return `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.month}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.person_name || '-'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${item.subfolder_name}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${talkRatioColor}">
          ${talkRatioPercent}%
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${questionsColor}">
          ${item.questions_asked}回
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${monologueColor}">
          ${item.max_sales_monologue_sec}秒
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${confusionColor}">
          ${confusionPercent}%
        </td>
      </tr>
    `;
    })
    .join('');

  tableBody.innerHTML = rows;
}

// Populate call selector
function populateCallSelector(data) {
  const selector = document.getElementById('callSelector');

  const options = data.map((item, index) => {
    // Extract customer name from file name
    const customerMatch = item.file_name.match(/\(([^)]+)\)/);
    const customerName = customerMatch ? customerMatch[1] : 'Unknown';

    return `<option value="${index}">${item.month}_${item.subfolder_name}_${customerName}</option>`;
  });

  selector.innerHTML = '<option value="">選択してください...</option>' + options.join('');

  // Add change event listener
  selector.addEventListener('change', (e) => {
    const index = parseInt(e.target.value);
    if (!isNaN(index) && salesData[index]) {
      renderCallDetail(salesData[index]);
    }
  });
}

// Render call detail
function renderCallDetail(call) {
  const detailDiv = document.getElementById('callDetail');

  const talkRatioPercent = (call.talk_ratio_sales * 100).toFixed(1);
  const customerRatioPercent = (call.talk_ratio_customer * 100).toFixed(1);
  const confusionPercent = (call.confusion_ratio * 100).toFixed(1);
  const stressPercent = (call.stress_ratio * 100).toFixed(1);
  const positivePercent = (call.positive_ratio * 100).toFixed(1);

  const improvements = call.improvements ? call.improvements.split('\n') : [];

  const html = `
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-xl font-bold text-gray-800 mb-4">${call.subfolder_name}</h3>
      <p class="text-sm text-gray-600 mb-6">${call.file_name}</p>

      <!-- Metrics Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-blue-50 p-4 rounded-lg">
          <div class="text-sm text-gray-600">営業発話比率</div>
          <div class="text-2xl font-bold text-blue-600">${talkRatioPercent}%</div>
        </div>
        <div class="bg-green-50 p-4 rounded-lg">
          <div class="text-sm text-gray-600">顧客発話比率</div>
          <div class="text-2xl font-bold text-green-600">${customerRatioPercent}%</div>
        </div>
        <div class="bg-purple-50 p-4 rounded-lg">
          <div class="text-sm text-gray-600">質問回数</div>
          <div class="text-2xl font-bold text-purple-600">${call.questions_asked}回</div>
        </div>
        <div class="bg-orange-50 p-4 rounded-lg">
          <div class="text-sm text-gray-600">最長モノローグ</div>
          <div class="text-2xl font-bold text-orange-600">${call.max_sales_monologue_sec}秒</div>
        </div>
      </div>

      <!-- Emotion Analysis -->
      <div class="mb-6">
        <h4 class="text-lg font-semibold mb-3">感情分析</h4>
        <div class="grid grid-cols-3 gap-4">
          <div class="bg-red-50 p-4 rounded-lg">
            <div class="text-sm text-gray-600">混乱率</div>
            <div class="text-xl font-bold text-red-600">${confusionPercent}%</div>
          </div>
          <div class="bg-yellow-50 p-4 rounded-lg">
            <div class="text-sm text-gray-600">ストレス率</div>
            <div class="text-xl font-bold text-yellow-600">${stressPercent}%</div>
          </div>
          <div class="bg-green-50 p-4 rounded-lg">
            <div class="text-sm text-gray-600">ポジティブ率</div>
            <div class="text-xl font-bold text-green-600">${positivePercent}%</div>
          </div>
        </div>
      </div>

      <!-- Advice Sections -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="border border-gray-200 rounded-lg p-4">
          <h5 class="font-semibold text-gray-800 mb-2">👂 傾聴力</h5>
          <p class="text-sm text-gray-700">${call.listening_advice || 'N/A'}</p>
        </div>
        <div class="border border-gray-200 rounded-lg p-4">
          <h5 class="font-semibold text-gray-800 mb-2">❓ 質問力</h5>
          <p class="text-sm text-gray-700">${call.questioning_advice || 'N/A'}</p>
        </div>
        <div class="border border-gray-200 rounded-lg p-4">
          <h5 class="font-semibold text-gray-800 mb-2">💬 説明力</h5>
          <p class="text-sm text-gray-700">${call.explanation_advice || 'N/A'}</p>
        </div>
        <div class="border border-gray-200 rounded-lg p-4">
          <h5 class="font-semibold text-gray-800 mb-2">😊 顧客体験</h5>
          <p class="text-sm text-gray-700">${call.customer_experience || 'N/A'}</p>
        </div>
      </div>

      <!-- Improvements -->
      ${
        improvements.length > 0
          ? `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 class="font-semibold text-blue-900 mb-2">📝 改善提案 TOP3</h5>
        <ul class="list-disc list-inside space-y-1">
          ${improvements.map((imp) => `<li class="text-sm text-blue-800">${imp}</li>`).join('')}
        </ul>
      </div>
      `
          : ''
      }
    </div>
  `;

  detailDiv.innerHTML = html;
  detailDiv.classList.remove('hidden');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSalesSummary();
});
