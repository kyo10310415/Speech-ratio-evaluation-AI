# 🧪 セールス評価機能 テスト実行ガイド

## 📋 テスト前の確認事項

### 1. Google Sheets の準備
以下のスプレッドシートを開いて確認：
```
https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit
```

**必要なシート**:
- ✅ `セールスフォルダ` シート（既存）
  - A列: フォルダ名
  - B列: フォルダURL
  - データが入っていることを確認

- ⭕ `sales_evaluations` シート（自動作成される）
  - テスト実行時に自動で作成されます
  - 既に存在する場合は、データが追加されます

---

### 2. Google Drive の準備

**セールスフォルダの構造**:
```
親フォルダ (B列のURL)
├── 子フォルダ1 (営業担当者名など)
│   ├── 動画1.mp4
│   ├── 動画2.mp4
│   └── 動画3.mp4
├── 子フォルダ2
│   ├── 動画1.mp4
│   └── 動画2.mp4
└── ...
```

**重要**:
- 各子フォルダから **今月作成された動画** を1つランダムに選択
- 動画ファイル名パターン: `名前:VTuber○○ - 日付`
- 今月の動画が無い子フォルダはスキップされます

---

### 3. API コストの確認

**使用するAPI**:
- Google Drive API（無料）
- Gemini 2.5 Flash API（有料）
  - 動画の文字起こし
  - 感情分析
  - レポート生成

**推定コスト**:
- 1動画あたり: 約$0.01-0.05（動画の長さによる）
- 子フォルダが10個の場合: 約$0.10-0.50

---

## 🚀 テスト実行手順

### 方法1: Render Shell で実行（推奨）

#### ステップ1: Render Shell にアクセス
```
https://dashboard.render.com/ → wannav-lesson-analyzer → Shell
```

#### ステップ2: スクリプトをダウンロード
```bash
cd /opt/render/project/src
curl -o test-sales-evaluation.sh https://raw.githubusercontent.com/kyo10310415/Speech-ratio-evaluation-AI/main/test-sales-evaluation.sh
chmod +x test-sales-evaluation.sh
```

#### ステップ3: テスト実行
```bash
./test-sales-evaluation.sh
```

実行確認が出るので、`y` を入力してEnter。

---

### 方法2: 直接コマンド実行

```bash
cd /opt/render/project/src

# 今月の年月を取得
CURRENT_MONTH=$(date -u +"%Y-%m")
echo "Processing month: $CURRENT_MONTH"

# セールス評価を実行
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

## 📊 実行中のログ

実行中は以下のようなログが表示されます：

```
========================================
SALES EVALUATION STARTED for 2026-01
========================================
Found 3 sales folders to evaluate
Processing folder: VTuberセールス1
Found 5 subfolders in VTuberセールス1
Selected video: 名前:VTuber太郎 - 2026-01-15.mp4 from 営業担当A
Analyzing sales call...
Transcribing audio...
Analyzing emotions...
Generating sales report...
========================================
SALES EVALUATION COMPLETED in 124.5s
Processed 5 sales calls
Success: 5, Failed: 0
========================================
```

---

## ✅ 結果の確認

### 1. Google Sheets で確認

```
https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit
```

**sales_evaluations シート**:
- 月（2026-01）
- サブフォルダ名（営業担当者名）
- ファイル名
- 評価指標:
  - 営業発話比率（40-50%が理想）
  - 顧客発話比率
  - 質問回数
  - 最長モノローグ時間
  - 混乱率/ストレス率/ポジティブ率
- 改善アドバイス:
  - 傾聴アドバイス
  - 質問アドバイス
  - 説明アドバイス
  - 顧客体験評価
  - 改善ポイント

---

### 2. ダッシュボードで確認

```
https://speech-ratio-evaluation-ai.onrender.com/sales
```

1. ページを開く
2. `Ctrl + Shift + R` で強制リロード
3. 以下を確認:
   - 📈 月次サマリーにデータが表示される
   - グラフが描画される
   - 📞 通話詳細で個別データを確認できる

---

## 🔍 トラブルシューティング

### エラー1: シート 'セールスフォルダ' が見つからない
```
Error: Sheet セールスフォルダ not found
```

**解決策**:
1. Google Sheets を開く
2. 新しいシート `セールスフォルダ` を作成
3. A列にフォルダ名、B列にフォルダURLを入力

---

### エラー2: フォルダが見つからない
```
Error: Cannot extract folder ID from URL
```

**解決策**:
- B列のURLが正しいGoogle DriveフォルダのURLか確認
- URL形式: `https://drive.google.com/drive/folders/FOLDER_ID`

---

### エラー3: 動画が見つからない
```
No videos found in subfolder XXX for 2026-01
```

**理由**:
- その子フォルダに今月作成された動画が無い
- 正常な動作です（スキップされます）

**確認方法**:
- Google Drive でフォルダを開く
- 今月作成された動画ファイルがあるか確認

---

### エラー4: Gemini API エラー
```
Error: Gemini API request failed
```

**解決策**:
1. Render Dashboard → Environment で確認:
   - `GEMINI_API_KEY` が設定されているか
   - APIキーが有効か

2. API制限を確認:
   - https://aistudio.google.com/ でAPIクォータを確認

---

## 📝 テスト後の確認項目

- [ ] Google Sheets の `sales_evaluations` シートにデータが追加された
- [ ] status 列が `OK` になっている（エラーなし）
- [ ] 発話比率が 0-100% の範囲内
- [ ] 改善アドバイスが日本語で記載されている
- [ ] ダッシュボードにデータが表示される
- [ ] グラフが正しく描画される

---

## 🎯 次のステップ

テストが成功したら：

1. **月次ジョブに統合済み**:
   - 毎月末23:00 JSTに自動実行
   - 講師評価と同時に実行される

2. **手動実行が必要な場合**:
   ```bash
   cd /opt/render/project/src
   node -e "
   import { runSalesEvaluation } from './src/jobs/salesEvaluation.js';
   runSalesEvaluation('2026-01').then(() => process.exit(0));
   "
   ```

3. **データの確認**:
   - 毎月のデータが `sales_evaluations` シートに蓄積される
   - ダッシュボードで月別に比較できる

---

## 💡 ヒント

- **初回実行**: すべての子フォルダを評価するため、時間がかかります（15-30分）
- **2回目以降**: 同じ月の場合、データが追加されます（重複注意）
- **データクリア**: 必要に応じて `sales_evaluations` シートを手動でクリア

---

## 📞 サポート

問題が発生した場合は、以下の情報を共有してください：
1. エラーメッセージ
2. 実行ログ（`/tmp/sales-evaluation-test-*.log`）
3. Google Sheets のスクリーンショット
