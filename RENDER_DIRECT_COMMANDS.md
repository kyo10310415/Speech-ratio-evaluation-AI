# 月次サマリー修正 - 直接実行コマンド

Renderにまだスクリプトがデプロイされていないため、以下のコマンドを直接実行してください。

## ステップ1: デバッグ（データ確認）

```bash
cd /opt/render/project/src

node -e "
import { sheetsService } from './services/sheetsService.js';

async function check() {
  await sheetsService.initialize();
  
  console.log('=== monthly_lessons ===');
  const lessons = await sheetsService.getSheetData('monthly_lessons');
  console.log('Lessons:', lessons.length - 1);
  
  console.log('\n=== monthly_tutors ===');
  const tutors = await sheetsService.getSheetData('monthly_tutors');
  console.log('Tutors:', tutors.length - 1);
  
  if (tutors.length > 1) {
    const headers = tutors[0];
    const firstTutor = tutors[1];
    console.log('\nFirst tutor data:');
    console.log('Month:', firstTutor[0]);
    console.log('Name:', firstTutor[1]);
    console.log('Lessons:', firstTutor[2]);
    console.log('Talk Ratio:', firstTutor[3], '(type:', typeof firstTutor[3] + ')');
    console.log('Silence:', firstTutor[4], '(type:', typeof firstTutor[4] + ')');
    console.log('Duration:', firstTutor[5], '(type:', typeof firstTutor[5] + ')');
    
    if (parseFloat(firstTutor[3]) === 0 || firstTutor[3] === '' || firstTutor[3] === '0') {
      console.log('\n❌ PROBLEM: Talk ratio is 0 or empty');
      console.log('📝 Solution: Clear monthly_tutors sheet and re-run monthly job');
    } else {
      console.log('\n✅ Data looks good');
    }
  }
}

check().catch(console.error);
"
```

## ステップ2: Google Sheetsでデータクリア

**重要**: 月次ジョブを実行する前に必ず実行してください

1. Google Sheets を開く:
   https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit

2. **monthly_tutors** シートを選択

3. **2行目以降すべて**を選択して削除（ヘッダー行は残す）

4. （オプション）**monthly_lessons** シートも同様にクリア

## ステップ3: 月次ジョブを実行

```bash
cd /opt/render/project/src

# ロックファイルを削除
rm -f temp/monthly-job.lock

# 月次ジョブを実行（バックグラウンド）
nohup node src/jobs/monthly.js 2026-01-15 > /tmp/monthly-job.log 2>&1 &

echo "✅ Monthly job started"
echo "📝 Logs: /tmp/monthly-job.log"
echo "⏱️  Processing time: ~2-3 hours"
```

## ステップ4: 進捗監視（オプション）

```bash
# リアルタイムでログを表示
tail -f /tmp/monthly-job.log

# 完了を確認
grep "COMPLETED" /tmp/monthly-job.log

# プロセスを確認
ps aux | grep "node src/jobs/monthly"
```

## ステップ5: 完了後に確認

### Google Sheets で確認
https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit

`monthly_tutors` シートで確認:
```
date_jst | tutor_name | avg_tutor_talk_ratio | avg_silence_15s_count | total_duration_min
2026-01  | あやこ先生  | 0.524                | 18.5                  | 112.3
```

- `avg_tutor_talk_ratio` が 0.4〜0.7（0ではない）
- `avg_silence_15s_count` が 10〜30（0ではない）
- `total_duration_min` が 50〜150（0ではない）

### ダッシュボードで確認
https://speech-ratio-evaluation-ai.onrender.com

月次サマリーテーブルで:
- 平均発話比率: **52.4%**（0%ではない）
- 平均沈黙回数: **18.5**（0ではない）
- 合計時間: **112分**（0分ではない）

---

## トラブルシューティング

### ジョブが途中で止まった場合

```bash
# プロセスを確認
ps aux | grep monthly

# 強制終了
pkill -f "node src/jobs/monthly"

# ロックファイル削除
rm -f temp/monthly-job.lock

# 再実行
nohup node src/jobs/monthly.js 2026-01-15 > /tmp/monthly-job.log 2>&1 &
```

### データが重複している場合

Google Sheets で古いデータを手動削除してから再実行してください。

---

## チェックリスト

- [ ] ステップ1: デバッグコマンドを実行してデータを確認
- [ ] ステップ2: Google Sheets で monthly_tutors の2行目以降を削除
- [ ] ステップ3: 月次ジョブを実行
- [ ] ステップ4: 2-3時間待機（Shell は閉じてOK）
- [ ] ステップ5: Google Sheets で結果を確認
- [ ] ステップ6: ダッシュボードで0でない値を確認

---

**所要時間**: 設定5分 + 処理2-3時間 = 合計2-3時間
