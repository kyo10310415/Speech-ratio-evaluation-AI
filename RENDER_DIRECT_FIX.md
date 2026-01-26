# 🔧 Render Shell での直接修正手順

## 問題
`audioService.extractAndNormalizeAudio` 関数が存在しない

## 解決方法
Render Shell で直接コードを修正

---

## 📝 Render Shell で実行

```bash
cd /opt/render/project/src

# バックアップ
cp src/services/salesEvaluationService.js src/services/salesEvaluationService.js.backup

# 修正1: extractAndNormalizeAudio を extractAudio + getAudioDuration に変更
sed -i '
/Extract and normalize audio/,/logger.info.*Extracted audio/ {
  s|// Extract and normalize audio|// Extract audio|
  s|const { audioPath, duration } = await audioService.extractAndNormalizeAudio(videoPath);|const audioPath = await audioService.extractAudio(videoPath, videoFile.id);\
      logger.info(\`Extracted audio: \${audioPath}\`);\
      \
      // Get audio duration\
      const duration = await audioService.getAudioDuration(audioPath);|
  /logger.info.*Extracted audio.*duration/d
}
' src/services/salesEvaluationService.js

# 修正2: audioService 初期化を追加
sed -i '
/try {/,/Download video/ {
  /logger.info.*Analyzing sales call/a\
      \
      // Initialize services\
      await audioService.initialize();
}
' src/services/salesEvaluationService.js

# 修正確認
echo "========================================="
echo "修正内容を確認"
echo "========================================="
grep -A 8 "Extract audio" src/services/salesEvaluationService.js | head -15
grep -A 3 "Initialize services" src/services/salesEvaluationService.js | head -5

echo ""
echo "✅ 修正完了"
echo ""
echo "サーバーを再起動:"
echo "pkill -f 'node src/dashboard/server.js'"
```

---

## 🚀 修正後の再テスト

```bash
cd /opt/render/project/src

CURRENT_MONTH=$(date -u +"%Y-%m")
echo "Processing month: $CURRENT_MONTH"

node -e "
import { runSalesEvaluation } from './src/jobs/salesEvaluation.js';

runSalesEvaluation('$CURRENT_MONTH')
  .then(() => {
    console.log('✅ Sales evaluation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Sales evaluation failed:', error);
    process.exit(1);
  });
"
```

---

## 期待される結果

```
========================================
SALES EVALUATION STARTED for 2026-01
========================================
Found 4 sales folders to evaluate
Processing folder: y.otomo@oneloopinc.net
Found 5 subfolders in y.otomo@oneloopinc.net
Selected video: 🔸松下祥大さん...
Analyzing sales call: 🔸松下祥大さん...
Extracted audio: /opt/render/project/src/temp/audio/xxxxx.wav
Audio duration: 1234.5s
Transcribed 150 utterances
Analyzing sales performance...
Generating sales report...
✅ Success

[続く...]

========================================
SALES EVALUATION COMPLETED in 450.2s
Processed 20 sales calls
Success: 18, Failed: 2
========================================
```
