# 全講師処理コマンド

## 📋 コマンド一覧

### 1. テストモード（最初の講師のみ）
```bash
# 昨日のデータで最初の講師のみテスト
npm run daily:test

# 特定日付で最初の講師のみテスト
npm run daily:test 2026-01-13
```

**処理時間**: 約10-15分  
**対象**: 最初の講師（1名）のみ

---

### 2. 本番モード（全講師）
```bash
# 昨日のデータで全講師処理
npm run daily

# または
npm run daily:full

# 特定日付で全講師処理
node src/jobs/daily.js 2026-01-13
```

**処理時間**: 約1.5-2時間（5並列、35本想定）  
**対象**: 全講師（23名）

---

## 🚀 Render Shell での実行

### 1. Render Shell を開く
1. https://dashboard.render.com/ にアクセス
2. `wannav-lesson-analyzer` を選択
3. 右上の「Shell」ボタンをクリック

### 2. コマンドを実行

#### テストモード（最初の講師のみ）
```bash
# 昨日のデータ
node src/jobs/daily-test.js

# 特定日付
node src/jobs/daily-test.js 2026-01-13
```

#### 本番モード（全講師）
```bash
# 昨日のデータ
node src/jobs/daily.js

# 特定日付（例: 2026-01-13）
node src/jobs/daily.js 2026-01-13
```

---

## 📊 期待される出力

### テストモード（1講師）
```
========================================
Starting DAILY JOB TEST (FIRST ROW ONLY)
========================================
Test date: 2026-01-13
Processing date range: 2026-01-12T15:00:00Z to 2026-01-13T14:59:59Z
Found 23 tutor records
Processing ONLY first tutor: きょうへい先生

Processing tutor: きょうへい先生
Found 1 unprocessed video
Processing lesson: WannaVレッスン予約...
Video duration: 3367s
Transcription complete: 801 utterances
KPI analysis: tutor_ratio=78.6%

Appended 1 rows to daily_lessons
Wrote 1 lesson row to daily_tutors

========================================
DAILY JOB TEST COMPLETED SUCCESSFULLY in 728.03s
Processed 1 lessons (FIRST ROW ONLY)
========================================
```

### 本番モード（全講師）
```
========================================
Starting DAILY JOB
========================================
Processing date: 2026-01-13
Processing date range: 2026-01-12T15:00:00Z to 2026-01-13T14:59:59Z
Found 23 tutor records
Found 150 already processed files
Using concurrency: 5

Processing tutor: きょうへい先生
Processing tutor: 他の講師...
... (並列処理で5講師ずつ)

Processing lesson: WannaVレッスン予約...
Video duration: 3367s
Transcription complete: 801 utterances
KPI analysis: tutor_ratio=78.6%

... (35本の動画を処理)

Appended 35 rows to daily_lessons
Wrote 35 lesson rows to daily_tutors

========================================
DAILY JOB COMPLETED SUCCESSFULLY in 5400.00s
Processed 35 lessons
========================================
```

**処理時間**: 約90分（5400秒）

---

## ⚠️ 注意事項

### 1. 処理時間
- **テストモード**: 10-15分
- **本番モード**: 1.5-2時間

### 2. メモリ使用量
- **並列数**: 5（環境変数 `MAX_CONCURRENCY` で調整可）
- **メモリ**: 約4GB（Render Pro プランで十分）

### 3. コスト
- **Gemini API**: 無料枠内（35本 × 56分 = 約32時間分）
- **Render**: Pro プラン $85/月

### 4. 冪等性
- 同じ動画は2回処理されません
- `drive_file_id` でチェック
- エラー行は `npm run clear:errors` で削除後に再処理可能

---

## 🔍 進捗確認

### Render Logs
```
Render Dashboard → Logs タブ
```

リアルタイムで以下を確認：
- 処理中の講師名
- 処理済みレッスン数
- エラー（あれば）

### スプレッドシート
```
https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit
```

- `daily_lessons` シート: レッスン詳細
- `daily_tutors` シート: 講師別集計

---

## 🛑 処理の中断

### Render Shell での中断
```bash
# Ctrl + C
# または Shell を閉じる
```

**注意**: 
- 処理中のレッスンは完了しない
- 次回実行時に再処理される（冪等性）
- ロックファイルは4時間後に自動クリア

---

## 📈 パフォーマンス比較

| モード | 対象 | 処理時間 | コマンド |
|--------|------|----------|----------|
| テスト | 1講師 | 10-15分 | `npm run daily:test` |
| 本番 | 全講師 | 1.5-2時間 | `npm run daily` |

---

## 🎯 よくあるユースケース

### ケース1: 昨日のデータを全講師で処理
```bash
# Render Shell
node src/jobs/daily.js
```

### ケース2: 特定日付を全講師で処理
```bash
# 例: 2026-01-13
node src/jobs/daily.js 2026-01-13
```

### ケース3: テスト実行（最初の講師のみ）
```bash
# 動作確認用
node src/jobs/daily-test.js 2026-01-13
```

### ケース4: 週次サマリー生成
```bash
# 毎週月曜日に自動実行されるが、手動でも可能
node src/jobs/weekly.js
```

---

## ✅ 実行チェックリスト

### 実行前
- [ ] Render Dashboard で環境変数を確認
- [ ] ダッシュボードが起動しているか確認
- [ ] スプレッドシートにアクセス可能か確認

### 実行中
- [ ] Render Logs で進捗を確認
- [ ] メモリ使用量を監視（4GB以内）
- [ ] エラーが発生していないか確認

### 実行後
- [ ] スプレッドシートに新しいデータが追加されたか確認
- [ ] ダッシュボードでデータが表示されるか確認
- [ ] `npm run monitor:errors` でエラー率を確認

---

## 🚀 まとめ

### テストしたい場合
```bash
npm run daily:test 2026-01-13
```

### 本番実行したい場合
```bash
node src/jobs/daily.js 2026-01-13
```

### 自動実行（設定済み）
- **Daily**: 毎日 09:00 JST（全講師）
- **Weekly**: 毎週月曜日 12:00 JST

---

以上です！全講師処理のコマンドがわかりました 🎉
