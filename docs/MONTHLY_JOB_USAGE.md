# 月次評価ジョブ使用ガイド

## 📊 参照先シート変更

**変更内容**: `新フォルダURL` → `コピー先URL`

### スプレッドシート構造
```
シート名: コピー先URL

A列: 講師名（例: りょうや先生、まり先生）
B列: （未使用）
C列: コピー先フォルダURL（GASで作成したコピー先フォルダ）
D列: （その他のデータ）
```

**重要**: GASの改善版（`google-apps-script-incremental-copy.js`）を使って、元のフォルダをマイドライブにコピーし、そのURLをC列に記録してください。

---

## 🚀 月次評価の実行方法

### 1. **通常の月次評価（全講師）**

```bash
cd /opt/render/project/src

# 当月の全講師を評価
node src/jobs/monthly.js

# 特定の月を評価（例: 2026年1月）
node src/jobs/monthly.js 2026-01-15
```

### 2. **特定の講師のみ評価（エラー再実行用）**

```bash
cd /opt/render/project/src

# 当月の特定講師を評価
node src/jobs/monthly.js null "りょうや先生"

# 特定月の特定講師を評価
node src/jobs/monthly.js 2026-01-15 "りょうや先生"
```

**パラメータ説明**:
- 第1引数: 日付（`YYYY-MM-DD` 形式、または `null` で当月）
- 第2引数: 講師名（完全一致、スペース含む）

### 3. **利用可能な講師名を確認**

```bash
cd /opt/render/project/src

node -e "
import { sheetsService } from './src/services/sheetsService.js';
(async () => {
  await sheetsService.initialize();
  const records = await sheetsService.readInputSheet();
  console.log('利用可能な講師名:');
  records.forEach((r, i) => {
    console.log(\`  \${i + 1}. \${r.tutorName}\`);
  });
  process.exit(0);
})();
"
```

---

## 📝 月次評価の仕様

### **処理内容**
1. `コピー先URL` シートから講師名（A列）とフォルダURL（C列）を読み込み
2. 各講師のフォルダから当月の動画を取得
3. **ランダムに2本選択**して分析
4. 結果を `monthly_lessons` シートに書き込み
5. 講師別の集計を `monthly_tutors` シートに書き込み

### **月次集計（monthly_tutors）の項目**
| 列 | 項目 | 説明 |
|----|------|------|
| A | date_jst | 月（YYYY-MM 形式） |
| B | tutor_name | 講師名 |
| C | lessons_count | 評価したレッスン数 |
| D | avg_talk_ratio_tutor | 平均発話比率 |
| E | avg_max_tutor_monologue_sec | 平均最長モノローグ（秒） |
| F | avg_confusion_ratio_est | 平均混乱率 |
| G | avg_stress_ratio_est | 平均ストレス率 |
| H | alerts | アラート（発話比率高、モノローグ長、混乱多、ストレス多） |

### **アラート条件**
- `発話比率高`: avg_talk_ratio_tutor > 0.6 (60%)
- `モノローグ長`: avg_max_tutor_monologue_sec > 180秒
- `混乱多`: avg_confusion_ratio_est > 0.4 (40%)
- `ストレス多`: avg_stress_ratio_est > 0.4 (40%)

---

## 🔧 エラー時の対応

### **特定の講師でエラーが発生した場合**

1. **エラーログを確認**:
```bash
# 最新のログを確認
cat /opt/render/project/src/logs/app.log | grep -A 10 "講師名"
```

2. **特定講師を再実行**:
```bash
# 例: りょうや先生のみ再評価
node src/jobs/monthly.js null "りょうや先生"
```

3. **結果を確認**:
```bash
# monthly_lessons シートで講師名でフィルタ
# status列が OK になっていることを確認
```

### **よくあるエラー**

#### **Error: Tutor not found**
```
Tutor not found: りょうや先生
Available tutors: りょうや先生, まり先生, ...
```

**原因**: 講師名のスペルミスまたは半角/全角の違い

**解決**: 利用可能な講師名を確認して、正確にコピー

#### **Error: No videos found**
```
No videos found for りょうや先生 in 2026-01
```

**原因**: 指定月にフォルダ内に動画が存在しない

**解決**: 
1. Google Driveでフォルダを確認
2. 動画の作成日時を確認
3. 別の月を指定

#### **Error: Failed to download file**
```
Failed to download file: xxxx
```

**原因**: サービスアカウントにフォルダの閲覧権限がない

**解決**:
1. Google Driveでフォルダを開く
2. 共有設定でサービスアカウントを追加
3. 権限: 編集者

---

## 📊 実行例

### **例1: 全講師の当月評価**
```bash
cd /opt/render/project/src
node src/jobs/monthly.js

# 出力例:
# Starting MONTHLY JOB
# Processing month: 2026-02
# Found 10 tutor records
# Processing tutor: りょうや先生
# Found 8 videos for りょうや先生 in 2026-02
# Randomly selected 2 videos for りょうや先生
# ...
# MONTHLY JOB COMPLETED SUCCESSFULLY in 245.32s
# Processed 20 lessons (random 2 per tutor)
```

### **例2: 特定講師のみ再評価**
```bash
cd /opt/render/project/src
node src/jobs/monthly.js null "りょうや先生"

# 出力例:
# Starting MONTHLY JOB
# SPECIFIC TUTOR MODE: Only processing りょうや先生
# Processing month: 2026-02
# Found 1 tutor records
# Processing tutor: りょうや先生
# Found 8 videos for りょうや先生 in 2026-02
# Randomly selected 2 videos for りょうや先生
# ...
# MONTHLY JOB COMPLETED SUCCESSFULLY in 24.18s
# Processed 2 lessons (random 2 per tutor)
```

### **例3: 過去の月を評価**
```bash
cd /opt/render/project/src
node src/jobs/monthly.js 2026-01-15

# 出力例:
# Starting MONTHLY JOB
# TEST MODE: Processing month containing 2026-01-15
# Processing month: 2026-01
# ...
```

---

## 📚 関連ファイル

- **メインスクリプト**: `src/jobs/monthly.js`
- **シートサービス**: `src/services/sheetsService.js`
- **集計関数**: `src/utils/sheetFormatters.js`
- **GASコピースクリプト**: `docs/google-apps-script-incremental-copy.js`

---

## ❓ トラブルシューティング

### **Q: 講師名がわからない**
```bash
node -e "import { sheetsService } from './src/services/sheetsService.js'; (async () => { await sheetsService.initialize(); const records = await sheetsService.readInputSheet(); console.log('利用可能な講師名:'); records.forEach((r, i) => { console.log(\`  \${i + 1}. \${r.tutorName}\`); }); process.exit(0); })();"
```

### **Q: 複数の講師を再評価したい**
```bash
# 複数実行
node src/jobs/monthly.js null "りょうや先生"
node src/jobs/monthly.js null "まり先生"
node src/jobs/monthly.js null "原田先生"
```

または、シェルスクリプトを作成:
```bash
#!/bin/bash
for tutor in "りょうや先生" "まり先生" "原田先生"; do
  echo "Processing: $tutor"
  node src/jobs/monthly.js null "$tutor"
done
```

### **Q: 感情分析の値が全て0.3になる**
これは既知のバグです。詳細は `src/services/salesEvaluationService.js` のデバッグログを確認してください。

---

**更新日**: 2026-02-02  
**バージョン**: 1.0.0
