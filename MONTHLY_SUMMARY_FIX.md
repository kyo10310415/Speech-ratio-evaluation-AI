# 月次サマリーが0になる問題 - 解決手順

## 現状

✅ **ユーザーマニュアル**: 修正完了。表示されるようになった  
❌ **月次サマリー**: まだ0と表示される

スクリーンショットより:
- 月: (空)
- 講師: あやこ先生
- レッスン数: 2
- 平均発話比率: **0.0%** ← 問題
- 平均沈黙回数: **0.0** ← 問題
- 合計時間(分): **0分** ← 問題

---

## 原因分析

### 可能性1: Google Sheets に古いデータ形式が残っている ⭐ 最も可能性が高い

`monthly_tutors` シートが以前の `aggregateDailyTutors()` で書き込まれたため、列構造が異なる可能性があります。

**旧形式** (aggregateDailyTutors):
```
date_jst, tutor_name, lessons_count, avg_talk_ratio_tutor, avg_max_tutor_monologue_sec, total_interruptions_tutor_over_student, avg_confusion_ratio_est, avg_stress_ratio_est, alerts
```

**新形式** (aggregateMonthlyTutors):
```
date_jst, tutor_name, lessons_count, avg_tutor_talk_ratio, avg_silence_15s_count, total_duration_min
```

### 可能性2: データ型の問題

Google Sheets で数値が文字列として保存されている可能性があります。

### 可能性3: 月次ジョブが正しく実行されていない

最新の `aggregateMonthlyTutors()` 関数が使われていない可能性があります。

---

## 🔧 解決手順

### ステップ1: Render にアクセス

1. https://dashboard.render.com/ にログイン
2. `wannav-lesson-analyzer` サービスを選択
3. 右上の **Shell** ボタンをクリック

### ステップ2: デバッグスクリプトを実行

Render Shell で以下を実行:

```bash
cd /opt/render/project/src
node debug-monthly-summary.js
```

**このスクリプトが確認すること:**
- ✅ monthly_lessons にデータがあるか
- ✅ monthly_tutors のヘッダー構造
- ✅ データ型（文字列 vs 数値）
- ✅ 実際の値とその型

**期待される出力例:**
```
🔍 Debugging Monthly Summary Issue...
✅ Sheets service initialized
=== Checking monthly_lessons ===
✅ Found 46 lessons
📊 First Lesson Sample:
  Tutor: あやこ先生
  Duration: 3456 sec
  Talk Ratio: 0.524
  Silence 15s: 18
  Status: OK
...
```

### ステップ3: 問題に応じた対処

#### パターンA: "No lesson data found" と表示された場合

月次ジョブが実行されていません。

```bash
cd /opt/render/project/src
rm -f temp/monthly-job.lock
node src/jobs/monthly.js 2026-01-15
```

処理時間: 約2-3時間（並列処理で23講師×2件=46レッスン）

#### パターンB: "PROBLEM DETECTED: avg_tutor_talk_ratio is 0" と表示された場合

データ形式が古いか、集計に失敗しています。

**解決方法1: Google Sheets で手動クリア（推奨）**

1. Google Sheets を開く: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID
2. `monthly_tutors` シートを選択
3. 2行目以降のデータをすべて選択して削除（ヘッダー行は残す）
4. Render Shell で月次ジョブを再実行:
   ```bash
   cd /opt/render/project/src
   rm -f temp/monthly-job.lock
   node src/jobs/monthly.js 2026-01-15
   ```

**解決方法2: シートを削除して再作成**

1. Google Sheets で `monthly_tutors` シートのタブを右クリック → **削除**
2. `monthly_lessons` シートも削除（オプション）
3. Render Shell で月次ジョブを実行:
   ```bash
   cd /opt/render/project/src
   rm -f temp/monthly-job.lock
   node src/jobs/monthly.js 2026-01-15
   ```

### ステップ4: 処理の監視

月次ジョブは長時間かかるため、別の方法で監視します:

**方法1: ログファイルで監視**
```bash
# 別のターミナルで
tail -f /tmp/monthly-job.log
```

**方法2: プロセスを確認**
```bash
ps aux | grep "node src/jobs/monthly"
```

**方法3: 完了を確認**
```bash
grep "COMPLETED" /tmp/monthly-job.log
```

期待される完了メッセージ:
```
========================================
MONTHLY JOB COMPLETED SUCCESSFULLY in 7234.56s
Processed 46 lessons (random 2 per tutor)
Parallel processing: 46 succeeded, 0 failed
========================================
```

### ステップ5: 結果を確認

#### Google Sheets で確認

https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID

**monthly_tutors シート:**
```
date_jst | tutor_name | lessons_count | avg_tutor_talk_ratio | avg_silence_15s_count | total_duration_min
---------|------------|---------------|----------------------|----------------------|-------------------
2026-01  | あやこ先生  | 2             | 0.524                | 18.5                  | 112.3
2026-01  | 太郎先生    | 2             | 0.587                | 15.2                  | 95.7
```

**確認ポイント:**
- ✅ `avg_tutor_talk_ratio` が 0.4〜0.7 の範囲（0.524 = 52.4%）
- ✅ `avg_silence_15s_count` が 10〜30 の範囲
- ✅ `total_duration_min` が 50〜150 の範囲

#### ダッシュボードで確認

https://speech-ratio-evaluation-ai.onrender.com

**月次サマリーテーブル:**
- 月: 2026-01
- 講師: あやこ先生
- レッスン数: 2
- 平均発話比率: **52.4%** ← 0%でなければOK
- 平均沈黙回数: **18.5** ← 0でなければOK
- 合計時間: **112分** ← 0分でなければOK

---

## ⚠️ 注意事項

### 処理時間
- 月次ジョブ: 約2-3時間（46レッスン、並列処理5）
- バックグラウンド実行なので、Shell を閉じてもOK

### ロックファイル
- ジョブが途中で中断された場合、ロックファイルが残る
- 次回実行前に必ず削除: `rm -f temp/monthly-job.lock`

### データの上書き
- 月次ジョブは **追記** するため、同じ月を再実行すると重複する
- 再実行前に Google Sheets で古いデータを削除すること

---

## 🎯 簡易版手順（TL;DR）

```bash
# 1. Render Shell にアクセス
# https://dashboard.render.com/ → wannav-lesson-analyzer → Shell

# 2. Google Sheets で monthly_tutors の2行目以降を削除

# 3. 月次ジョブを実行
cd /opt/render/project/src
rm -f temp/monthly-job.lock
nohup node src/jobs/monthly.js 2026-01-15 > /tmp/monthly-job.log 2>&1 &

# 4. 完了を待つ（約2-3時間）
tail -f /tmp/monthly-job.log

# 5. ダッシュボードで確認
# https://speech-ratio-evaluation-ai.onrender.com
```

---

## 📞 トラブルシューティング

### Q: ジョブが途中で止まった
```bash
# プロセスを確認
ps aux | grep monthly

# 強制終了
pkill -f "node src/jobs/monthly"

# ロックファイル削除
rm -f temp/monthly-job.lock

# 再実行
node src/jobs/monthly.js 2026-01-15
```

### Q: エラーが発生した
```bash
# エラーログを確認
tail -100 /tmp/monthly-job.log

# または
npm run monitor:errors
```

### Q: データが重複している
Google Sheets で古いデータを手動削除してから再実行。

---

## 📝 関連ドキュメント

- `TROUBLESHOOTING.md`: 一般的なトラブルシューティング
- `MONTHLY_EVALUATION_GUIDE.md`: 月次評価システムの詳細
- `README.md`: システム全体の説明

---

## ✅ 完了チェックリスト

- [ ] Render Shell にアクセスした
- [ ] デバッグスクリプトを実行した
- [ ] Google Sheets で monthly_tutors を確認した
- [ ] 必要に応じて古いデータを削除した
- [ ] 月次ジョブを実行した
- [ ] 処理完了を確認した（COMPLETED メッセージ）
- [ ] Google Sheets でデータが正しいことを確認した
- [ ] ダッシュボードで0でない値が表示されることを確認した

---

**最終更新**: 2026-01-17  
**バージョン**: v3.0.2
