#!/bin/bash

# セールス評価テスト実行スクリプト
# Render Shell で実行してください

set -e

cd /opt/render/project/src

echo "========================================="
echo "セールス評価 テスト実行"
echo "========================================="
echo ""
echo "⚠️  注意事項:"
echo "  - Google Drive API を使用するため、実際の動画ファイルを処理します"
echo "  - Gemini API を使用するため、APIコストが発生します"
echo "  - 処理時間: 約5-15分（動画の長さによる）"
echo ""
echo "実行する月: 2026-01（今月）"
echo ""

# 現在の月を取得
CURRENT_MONTH=$(date -u +"%Y-%m")
echo "処理対象月: $CURRENT_MONTH"
echo ""

# 確認プロンプト
read -p "テスト実行しますか？ (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ キャンセルされました"
    exit 0
fi

echo ""
echo "🚀 セールス評価ジョブを開始します..."
echo ""

# ログファイル
LOG_FILE="/tmp/sales-evaluation-test-$(date +%Y%m%d-%H%M%S).log"

# セールス評価を実行
node -e "
import { runSalesEvaluation } from './src/jobs/salesEvaluation.js';

runSalesEvaluation('$CURRENT_MONTH')
  .then(() => {
    console.log('✅ セールス評価が完了しました');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ セールス評価が失敗しました:', error);
    process.exit(1);
  });
" 2>&1 | tee "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "========================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ テスト完了"
    echo ""
    echo "📊 結果を確認:"
    echo "  1. Google Sheets を開く:"
    echo "     https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit"
    echo ""
    echo "  2. 'sales_evaluations' シートを確認"
    echo ""
    echo "  3. ダッシュボードを確認:"
    echo "     https://speech-ratio-evaluation-ai.onrender.com/sales"
    echo "     （Ctrl+Shift+R で強制リロード）"
    echo ""
    echo "📝 ログファイル: $LOG_FILE"
else
    echo "❌ テスト失敗"
    echo ""
    echo "📝 エラーログ: $LOG_FILE"
    echo ""
    echo "エラー内容を確認してください:"
    echo "  cat $LOG_FILE"
fi
echo "========================================="
