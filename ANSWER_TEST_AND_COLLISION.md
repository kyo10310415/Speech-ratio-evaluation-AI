# 回答: テストとジョブ重複の問題

## 質問1: 自動実行と同じ内容でテストしたい

### ✅ 推奨方法: Render Shell

1. **Render Dashboard を開く**
   ```
   https://dashboard.render.com/
   ```

2. **サービスを選択**
   - `wannav-lesson-analyzer` をクリック

3. **Shell を開く**
   - 右上の「Shell」ボタンをクリック

4. **テストコマンドを実行**
   ```bash
   # 昨日のデータでテスト（最初の講師のみ）
   node src/jobs/daily-test.js
   
   # 特定日付でテスト
   node src/jobs/daily-test.js 2026-01-13
   
   # 週次ジョブのテスト
   node src/jobs/weekly.js
   ```

### 📊 期待されるログ
```
=== DAILY JOB TEST (FIRST ROW ONLY) ===
Test date: 2026-01-13
Processing tutor: きょうへい先生
Processing lesson: WannaVレッスン予約...
Video duration: 3367s
Transcription complete: 801 utterances
KPI analysis: tutor_ratio=78.6%
Appended 1 rows to daily_lessons
DAILY JOB TEST COMPLETED SUCCESSFULLY in 728.03s
```

### 🔍 他の方法
- **GitHub Actions**: 手動実行（Settings > Secrets 設定が必要）
- **ローカル環境**: `.env` ファイルを作成して `npm run daily:test`

**詳細**: [TEST_RENDER.md](./TEST_RENDER.md)

---

## 質問2: DailyとWeeklyが重なった時はどうなる？

### ❌ 元の問題

#### スケジュール
- **Daily**: 毎日 09:00 JST（月曜日含む）
- **Weekly**: 毎週月曜日 10:00 JST

#### 問題点
```
月曜日:
09:00: Daily Job 開始（処理時間 1.5-2時間）
  ↓ 処理中...
10:00: Weekly Job 開始（Daily がまだ動いている）
  ↓ 並列実行
  ↓ メモリ不足（4GB超過）
  ↓ サービスクラッシュ 💥
```

### ✅ 解決策

#### 1. スケジュール調整
- **Daily**: 毎日 09:00 JST（変更なし）
- **Weekly**: 毎週月曜日 **12:00 JST**（2時間遅らせる）

```javascript
// src/scheduler/jobScheduler.js
// Daily: 09:00 JST
cron.schedule('0 9 * * *', ...)

// Weekly: 12:00 JST (月曜日)
cron.schedule('0 12 * * 1', ...)
```

#### 2. ロックメカニズム
ファイルベースのロックで重複実行を防止：

```javascript
// src/utils/jobLock.js
class JobLock {
  acquire() {
    // ロックファイルが存在する場合、実行をスキップ
    if (existsSync(this.lockFile)) {
      logger.warn('⚠️ Job already running, skipping...');
      return false;
    }
    // ロックファイルを作成
    writeFileSync(this.lockFile, { timestamp, pid });
    return true;
  }
}
```

#### 3. 自動スキップ
```javascript
// スケジューラー
runDailyJob() {
  const lock = new JobLock('daily-job');
  if (lock.isLocked()) {
    logger.warn('⚠️ Daily job already running, skipping...');
    return;
  }
  // ジョブを実行
}
```

---

## 動作フロー（修正後）

### 通常の日（火〜日）
```
09:00 JST: Daily Job 開始
  ↓ ロック取得: daily-job.lock
  ↓ 処理中（1.5-2時間）
11:00 JST: Daily Job 完了
  ↓ ロック解放: daily-job.lock 削除
```

### 月曜日
```
09:00 JST: Daily Job 開始
  ↓ ロック取得: daily-job.lock
  ↓ 処理中（1.5-2時間）
11:00 JST: Daily Job 完了
  ↓ ロック解放: daily-job.lock 削除

12:00 JST: Weekly Job 開始
  ↓ ロック確認: daily-job.lock 不在 ✅
  ↓ ロック取得: weekly-job.lock
  ↓ 処理中（10-15分）
13:00 JST: Weekly Job 完了
  ↓ ロック解放: weekly-job.lock 削除
```

**結果**: 
- ✅ 並列実行なし
- ✅ メモリ使用量: 4GB以内
- ✅ サービス安定動作

---

## セーフティメカニズム

### 1. 古いロックの自動クリア
4時間以上古いロックは自動的に無効化：

```javascript
if (lockAge > 4 * 60 * 60 * 1000) {
  logger.warn('Stale lock detected, overriding...');
  this.release();
}
```

**理由**: ジョブがクラッシュした場合、ロックが残る → 4時間後に自動クリア

### 2. ロックファイルの内容
```json
{
  "timestamp": 1704931200000,
  "pid": 12345,
  "lockName": "daily-job"
}
```

### 3. スキップログ
```
⚠️ Daily job already running, skipping...
```

---

## テストシナリオ

### シナリオ1: 通常実行
```bash
node src/jobs/daily.js
# ログ: ✅ Lock acquired: daily-job
# 処理...
# ログ: ✅ Lock released: daily-job
```

### シナリオ2: 重複実行の防止
```bash
# Terminal 1: Daily Job を実行
node src/jobs/daily.js &

# Terminal 2: 同時に Daily Job を実行（スキップされる）
node src/jobs/daily.js
# ログ: ⚠️ Job already running, skipping...
```

### シナリオ3: Render Shell でテスト
```bash
# Render Shell
node src/jobs/daily.js &

# 重複実行を試みる（スキップされる）
node src/jobs/daily.js
# ⚠️ Job already running, skipping...
```

---

## よくある質問

### Q1: 月曜日に Weekly が Daily の完了を待つ？
**A**: はい、12:00 JST に実行されるため、Daily（09:00-11:00）が完了しています。

### Q2: Daily が 12:00 を超えて続いた場合は？
**A**: Weekly がスキップされます（ロックが存在するため）。

**対策**: 
- Daily の処理が遅い場合、週次ジョブは翌日手動実行
- または Weekly の時刻を 13:00 に変更

### Q3: ロックファイルが削除されない場合は？
**A**: 4時間後に自動的にクリアされ、次回実行が可能になります。

### Q4: 手動実行時もロックは機能する？
**A**: はい、手動実行でも同じロックメカニズムが適用されます。

---

## モニタリング

### ロック状態の確認
```bash
# Render Shell
ls -la temp/*.lock
cat temp/daily-job.lock
```

### ログ確認
```bash
# Render Dashboard → Logs
✅ Lock acquired: daily-job
✅ Daily job completed successfully
✅ Lock released: daily-job

# スキップされた場合
⚠️ Daily job already running, skipping...
```

---

## まとめ

### ✅ 実装済み
1. **スケジュール調整**: Weekly を 12:00 JST に変更
2. **ロックメカニズム**: ファイルベースのロック
3. **自動スキップ**: 重複実行を自動検出してスキップ
4. **古いロッククリア**: 4時間後に自動クリア
5. **詳細ログ**: ロック状態を記録

### 🎯 期待される動作
- **月曜日**:
  - 09:00: Daily 実行（1.5-2時間）
  - 12:00: Weekly 実行（10-15分）
  - **並列実行なし** → メモリ安全

### 📊 パフォーマンス
- **メモリ使用量**: 4GB以内（1ジョブずつ）
- **処理時間**: Daily 1.5-2時間 + Weekly 10-15分 = 2-2.5時間
- **コスト**: Render Pro $85/月（変更なし）

---

## 次のステップ

1. **Render 再デプロイ**
   - Git push 済み → 自動デプロイ開始
   - Deploy タブでログ確認（約2-3分）

2. **テスト実行**
   - Render Shell で `node src/jobs/daily-test.js`
   - スプレッドシート確認
   - ダッシュボード確認

3. **月曜日の動作確認**
   - 2026-01-20（次の月曜日）
   - Render Logs で確認:
     ```
     09:00: 🕐 Daily job triggered at 09:00 JST
     12:00: 🕐 Weekly job triggered at 12:00 JST
     ```

---

## 参考ドキュメント

- **テスト方法**: [TEST_RENDER.md](./TEST_RENDER.md)
- **ロック機構**: [JOB_LOCK_MECHANISM.md](./JOB_LOCK_MECHANISM.md)
- **デプロイ手順**: [RENDER_DEPLOY_GUIDE.md](./RENDER_DEPLOY_GUIDE.md)

---

以上で、質問への回答と問題の解決が完了しました！🎉
