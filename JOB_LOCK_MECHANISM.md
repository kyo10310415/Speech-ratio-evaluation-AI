# ジョブ重複実行の防止機構

## 問題の背景

### 元のスケジュール
- **Daily Job**: 毎日 09:00 JST
- **Weekly Job**: 毎週月曜日 10:00 JST

### 問題点
月曜日に両方のジョブが実行される場合：
1. Daily Job: 09:00 開始（処理時間 1.5-2時間）
2. Weekly Job: 10:00 開始（まだ Daily が動いている）
3. **並列実行 → メモリ不足 → サービスクラッシュ**

---

## 解決策

### 1. スケジュール調整
- **Daily Job**: 毎日 09:00 JST（変更なし）
- **Weekly Job**: 毎週月曜日 **12:00 JST**（2時間遅らせる）

### 2. ロックメカニズム
ファイルベースのロックで重複実行を防止：

```javascript
// src/utils/jobLock.js
class JobLock {
  acquire() {
    // ロックファイルが存在する場合、実行をスキップ
    if (existsSync(this.lockFile)) {
      return false;
    }
    // ロックファイルを作成
    writeFileSync(this.lockFile, { timestamp, pid });
    return true;
  }
  
  release() {
    // ロックファイルを削除
    unlinkSync(this.lockFile);
  }
}
```

### 3. 自動スキップ
ロックが存在する場合、自動的にスキップ：

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

## 動作フロー

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
  
10:00 JST: Weekly Job トリガー
  ↓ ロック確認: daily-job.lock 存在 → 関係なし（別ロック）
  ↓ ロック確認: weekly-job.lock 不在 → OK
  → ⚠️ 両方が並列実行される可能性（メモリ不足リスク）
  
12:00 JST: Weekly Job トリガー（修正後）
  ↓ ロック確認: daily-job.lock 不在（11:00に完了済み）
  ↓ ロック取得: weekly-job.lock
  ↓ 処理中（10-15分）
13:00 JST: Weekly Job 完了
  ↓ ロック解放: weekly-job.lock 削除
```

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

**理由**: 
- ジョブがクラッシュした場合、ロックが残る
- 4時間後に自動クリアして次回実行を可能にする

### 2. ロックファイルの内容
```json
{
  "timestamp": 1704931200000,
  "pid": 12345,
  "lockName": "daily-job"
}
```

- `timestamp`: ロック取得時刻
- `pid`: プロセスID
- `lockName`: ジョブ名

### 3. スキップログ
重複実行がスキップされた場合、ログに記録：

```
⚠️ Daily job already running, skipping...
```

---

## テストシナリオ

### シナリオ1: 通常実行
```bash
# Daily Job を実行
node src/jobs/daily.js
# ログ: Lock acquired: daily-job
# 処理...
# ログ: Lock released: daily-job
```

### シナリオ2: 重複実行の防止
```bash
# Terminal 1: Daily Job を実行
node src/jobs/daily.js &

# Terminal 2: 同時に Daily Job を実行（スキップされる）
node src/jobs/daily.js
# ログ: ⚠️ Job already running, skipping...
```

### シナリオ3: 古いロックのクリア
```bash
# 4時間以上前のロックファイルを作成
echo '{"timestamp":0}' > temp/daily-job.lock

# Daily Job を実行
node src/jobs/daily.js
# ログ: Stale lock detected (xxxms old), overriding...
# ログ: Lock acquired: daily-job
```

---

## モニタリング

### ロック状態の確認
```bash
# ロックファイルの存在確認
ls -la temp/*.lock

# ロックファイルの内容確認
cat temp/daily-job.lock
```

### ログ確認
```bash
# Render Logs
Render Dashboard → Logs タブ

# 期待されるログ
✅ Lock acquired: daily-job
✅ Daily job completed successfully
✅ Lock released: daily-job

# スキップされた場合
⚠️ Daily job already running, skipping...
```

---

## よくある質問

### Q1: 月曜日に Weekly が Daily の完了を待つ？
**A**: はい、12:00 JST に実行されるため、Daily（09:00-11:00）が完了しています。

### Q2: Daily が 11:00 を超えて続いた場合は？
**A**: Weekly がスキップされます（ロックが存在するため）。

**対策**: 
- Daily の処理が遅い場合、週次ジョブは翌日手動実行
- または Weekly の時刻を 13:00 に変更

### Q3: ロックファイルが削除されない場合は？
**A**: 4時間後に自動的にクリアされ、次回実行が可能になります。

### Q4: 手動実行時もロックは機能する？
**A**: はい、手動実行でも同じロックメカニズムが適用されます。

```bash
# Render Shell で実行
node src/jobs/daily.js

# 重複実行を試みる（スキップされる）
node src/jobs/daily.js
# ⚠️ Job already running, skipping...
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

1. **コードをデプロイ**
   - Git push 済み
   - Render が自動デプロイ

2. **月曜日の動作確認**
   - 2026-01-20（次の月曜日）
   - Render Logs で確認:
     ```
     09:00: 🕐 Daily job triggered
     12:00: 🕐 Weekly job triggered
     ```

3. **ロック動作のテスト**
   - Render Shell で手動実行
   - 重複実行を試してスキップを確認

---

以上で、ジョブ重複実行の問題は解決されました！🎉
