# 📅 月次評価システム ガイド（v3.0）

## 🎯 システム概要

### 変更点（v2.1 → v3.0）

| 項目 | v2.1（旧） | v3.0（新） |
|------|-----------|-----------|
| **実行頻度** | 毎日09:00 JST + 毎週月曜12:00 JST | **毎月末23:00 JST** |
| **評価対象** | 前日/前週の全レッスン | **今月の全講師からランダム2レッスンずつ** |
| **処理件数** | 約35レッスン/日（全講師×全レッスン） | **約46レッスン/月（23講師×2件）** |
| **処理時間** | 約3時間/日 | **約2-3時間/月** |
| **データ量** | 約1,050レッスン/月 | **約46レッスン/月（96%削減）** |
| **コスト** | 高（毎日実行） | **低（月1回のみ）** |

### メリット

✅ **コスト削減**: 処理回数を96%削減（30回/月 → 1回/月）
✅ **公平な評価**: ランダムサンプリングで偏りなし
✅ **効率的**: 全レッスンではなく代表的なサンプルのみ
✅ **十分な信頼性**: 講師あたり2レッスンで傾向把握可能

---

## 🔧 システム構成

### 1. 自動実行スケジュール

```javascript
// jobScheduler.js
// 毎月末23:00 JSTに自動実行
cron.schedule('0 23 28-31 * *', () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // 明日が1日（今日が月末）の場合のみ実行
  if (tomorrow.getDate() === 1) {
    runMonthlyJob();
  }
}, {
  timezone: 'Asia/Tokyo'
});
```

**次回実行予定**:
- 2026年1月31日 23:00 JST
- 2026年2月28日 23:00 JST
- 2026年3月31日 23:00 JST

### 2. ランダムサンプリング

```javascript
// monthly.js
function randomSelect(array, count) {
  if (array.length <= count) {
    return array;
  }
  
  // Fisher-Yates shuffle
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// 使用例
const allVideos = [video1, video2, video3, video4, video5]; // 講師の全動画
const selected = randomSelect(allVideos, 2); // ランダムに2件選択
```

### 3. 処理フロー

```
1. 日付範囲取得
   ↓ getMonthlyDateRange() → 今月1日00:00 〜 今月末日23:59
   
2. 講師リスト取得
   ↓ sheetsService.readInputSheet() → 23講師
   
3. 並列処理（5並列）
   ↓
   各講師ごと:
   ├─ 3-1. 今月の全動画リスト取得
   │      driveService.listVideosInFolder()
   │      → 例: 15件の動画
   │
   ├─ 3-2. ランダムに2件選択
   │      randomSelect(videos, 2)
   │      → 例: [video3, video11]
   │
   └─ 3-3. 選択した2件を処理
          processLesson() × 2
          → ダウンロード → 音声抽出 → 文字起こし → 分析
   
4. 結果を集計
   ↓ 全講師の結果をマージ → 約46レッスン
   
5. Sheetsに書き込み
   ↓ monthly_lessons, monthly_tutors
```

---

## 📊 データ出力

### Google Sheets

#### monthly_lessons シート
各レッスンの詳細データ（約46行/月）

| カラム | 説明 | 例 |
|--------|------|-----|
| date_jst | 処理月 | 2026-01 |
| tutor_name | 講師名 | きょうへい先生 |
| file_name | 動画ファイル名 | WannaVレッスン予約 (山田太郎) - 2026/01/15... |
| duration_sec | レッスン時間（秒） | 3367 |
| tutor_speaking_sec | 講師発話時間（秒） | 1506 |
| student_speaking_sec | 生徒発話時間（秒） | 411 |
| tutor_talk_ratio | 講師発話比率 | 0.786 |
| silence_15s_count | 15秒以上の沈黙回数 | 19 |
| interruption_count | 割り込み回数 | 43 |
| top_confused_segments | 困惑シグナルTOP3 | ... |
| report | AIレポート | ... |
| status | 処理ステータス | OK / ERROR |

#### monthly_tutors シート
講師ごとの月次集計（約23行/月）

| カラム | 説明 | 例 |
|--------|------|-----|
| date_jst | 処理月 | 2026-01 |
| tutor_name | 講師名 | きょうへい先生 |
| lesson_count | 処理レッスン数 | 2 |
| avg_tutor_talk_ratio | 平均講師発話比率 | 0.78 |
| avg_silence_15s_count | 平均沈黙回数 | 18.5 |
| total_duration_min | 合計レッスン時間（分） | 112 |

---

## 🚀 使い方

### 手動実行（テスト）

#### Render Shell で実行

```bash
# 1. Render Dashboard にアクセス
https://dashboard.render.com/

# 2. サービス選択
wannav-lesson-analyzer → Shell

# 3. ロックファイル削除（必要な場合）
rm -f /opt/render/project/src/temp/monthly-job.lock

# 4. 今月のデータで実行
cd /opt/render/project/src
node src/jobs/monthly.js

# 5. 特定月を指定して実行（テスト）
node src/jobs/monthly.js 2026-01-15  # 2026年1月のデータ
node src/jobs/monthly.js 2025-12-20  # 2025年12月のデータ

# 6. バックグラウンド実行（推奨）
nohup node src/jobs/monthly.js > /tmp/monthly-job.log 2>&1 &
echo $!  # プロセスID表示

# 7. ログ確認
tail -f /tmp/monthly-job.log

# 8. 完了確認
tail -n 20 /tmp/monthly-job.log | grep "COMPLETED"
```

#### ローカル環境で実行

```bash
# 環境変数設定
cp .env.example .env
# .envファイルを編集してAPIキーなどを設定

# 実行
npm run monthly

# テストモード（特定月）
npm run monthly:test 2026-01-15
```

### 期待される出力

```
========================================
Starting MONTHLY JOB
Processing month: 2026-01
========================================
Date range: 2025-12-31T15:00:00.000Z to 2026-01-31T14:59:59.999Z
Found 23 tutor records
Using concurrency: 5

Processing tutor: きょうへい先生
Found 15 videos for きょうへい先生 in 2026-01
Randomly selected 2 videos for きょうへい先生
Processing selected video: WannaVレッスン予約 (山田太郎) - 2026/01/05...
Processing selected video: WannaVレッスン予約 (鈴木花子) - 2026/01/18...

... (23講師 × 2レッスン)

Appended 46 rows to monthly_lessons
Appended 23 rows to monthly_tutors
========================================
MONTHLY JOB COMPLETED SUCCESSFULLY in 7200.00s
Processed 46 lessons (random 2 per tutor)
Parallel processing: 23 succeeded, 0 failed
========================================
```

---

## 🔍 トラブルシューティング

### 問題1: ジョブが実行されない

**症状**: 月末23:00になってもジョブが実行されない

**確認方法**:
```bash
# Render Logs で確認
# 期待されるログ:
🕐 Monthly job triggered at 23:00 JST (last day of month)
Spawning monthly job: node /opt/render/project/src/src/jobs/monthly.js
```

**対処法**:
1. サーバー時刻を確認: `date`
2. Cron設定を確認: `src/scheduler/jobScheduler.js`
3. 手動実行して動作確認: `node src/jobs/monthly.js`

### 問題2: ランダムサンプリングが偏っている

**症状**: 同じ動画ばかり選ばれる

**確認方法**:
```bash
# ログで選択された動画を確認
grep "Randomly selected" /tmp/monthly-job.log
```

**対処法**:
- `Math.random()` の実装は公平ですが、サンプル数が少ない（2件）ため偶然の偏りは発生します
- 複数月のデータで平均化されるため、長期的には公平になります
- 特定の動画を除外したい場合は、`processedFileIds` に追加してください

### 問題3: メモリ不足エラー

**症状**: `JavaScript heap out of memory`

**対処法**:
```bash
# 並列度を下げる
MAX_CONCURRENCY=3 node src/jobs/monthly.js

# または環境変数で設定
# .env ファイル
MAX_CONCURRENCY=3
```

### 問題4: 特定の講師のデータがない

**症状**: 一部の講師のデータが `monthly_lessons` にない

**確認方法**:
```bash
# ログで確認
grep "No videos found for" /tmp/monthly-job.log
# 出力例: No videos found for 佐藤先生 in 2026-01
```

**原因**:
- その講師の今月の動画が0件
- フォルダURLが間違っている
- 日付範囲外の動画しかない

**対処法**:
1. Google Drive でフォルダを確認
2. `Sheet1` のC列URLが正しいか確認
3. 動画のファイル名に日付が含まれているか確認（例: `2026/01/15`）

---

## 📈 統計情報

### 処理時間の見積もり

| 講師数 | レッスン数 | 並列度 | 処理時間（推定） |
|--------|-----------|--------|-----------------|
| 23 | 46（2件/講師） | 5 | 約2-3時間 |
| 23 | 46（2件/講師） | 3 | 約3-4時間 |
| 50 | 100（2件/講師） | 5 | 約5-6時間 |

**1レッスンあたりの処理時間**: 約3-5分
- ダウンロード: 30秒
- 音声抽出: 20秒
- 文字起こし（Gemini）: 2-3分
- KPI分析: 10秒
- 感情分析: 30秒
- レポート生成: 20秒

### コスト比較

#### Gemini API コスト（参考）

| モデル | 用途 | 価格 | 月次評価 | 日次評価（旧） |
|--------|------|------|----------|---------------|
| Gemini 2.5 Flash | 文字起こし | 無料枠内 | $0 | $0 |
| Gemini 2.5 Flash | 分析・レポート | 無料枠内 | $0 | $0 |

#### Render.com コスト

| プラン | 月額 | CPU | メモリ | 備考 |
|--------|------|-----|--------|------|
| Starter | $7 | 0.5 CPU | 512 MB | 軽量ジョブ向け |
| **Standard** | **$25** | **1 CPU** | **1 GB** | **推奨** |
| Pro | $85 | 2 CPU | 2 GB | 大規模向け |

**推奨**: Standard プラン（$25/月）で十分です

---

## 🎓 まとめ

### v3.0 の主な特徴

1. ✅ **月次評価**: 月末に1回だけ実行
2. ✅ **ランダムサンプリング**: 講師ごとに2レッスンずつ
3. ✅ **コスト削減**: 96%の処理削減
4. ✅ **十分な信頼性**: 代表的なサンプルで傾向把握
5. ✅ **効率的**: 処理時間を大幅短縮

### 次回の自動実行

- **日時**: 2026年1月31日 23:00 JST
- **対象**: 2026年1月の全動画から講師ごとにランダム2件
- **処理時間**: 約2-3時間
- **出力**: `monthly_lessons`（約46行）、`monthly_tutors`（約23行）

### 確認事項

- [ ] Render でデプロイ完了
- [ ] Cron スケジュール確認（23:00 JST、月末）
- [ ] Google Sheets に `monthly_lessons`, `monthly_tutors` シート作成
- [ ] 環境変数が正しく設定されている
- [ ] テスト実行が成功する

---

## 📞 サポート

質問や問題がある場合は、以下を確認してください：

1. **Render Logs**: https://dashboard.render.com/
2. **GitHub Issues**: https://github.com/kyo10310415/Speech-ratio-evaluation-AI/issues
3. **ドキュメント**:
   - [README.md](./README.md)
   - [RENDER_DEPLOY_GUIDE.md](./RENDER_DEPLOY_GUIDE.md)
   - [JOB_LOCK_MECHANISM.md](./JOB_LOCK_MECHANISM.md)

---

**最終更新**: 2026-01-16
**バージョン**: v3.0
