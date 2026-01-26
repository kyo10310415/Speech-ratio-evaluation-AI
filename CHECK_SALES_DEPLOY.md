# 🔍 セールスページ未表示の原因確認

## 確認すべき項目

### 1. Render Shell でコード確認

Render Shell にアクセスして、最新のコードがデプロイされているか確認：

```bash
# Render Shell にアクセス
# https://dashboard.render.com/ → wannav-lesson-analyzer → Shell

# 作業ディレクトリに移動
cd /opt/render/project/src

# 現在のコミットを確認
git log --oneline -3

# /sales ルートが存在するか確認
grep -n "app.get('/sales'" src/dashboard/server.js

# sales.js ファイルが存在するか確認
ls -la public/static/js/sales.js
```

**期待される結果**:
- 最新コミット: `ab8dda3` または `ab0d3c4`
- `app.get('/sales'` が見つかる（375行目付近）
- `sales.js` ファイルが存在する

---

### 2. ブラウザでの確認

#### A. 直接URLでアクセス
```
https://speech-ratio-evaluation-ai.onrender.com/sales
```

**エラーが出る場合**:
- 404エラー → サーバーが再起動されていない
- 500エラー → APIエラー（Google Sheets関連）
- 白い画面 → JavaScript エラー

#### B. ブラウザコンソールを開く
1. `F12` を押す
2. Console タブを開く
3. `/sales` にアクセス
4. エラーメッセージを確認

**よくあるエラー**:
```
Failed to load resource: net::ERR_ABORTED 404 (Not Found)
/static/js/sales.js
```
→ sales.js がデプロイされていない

```
Uncaught ReferenceError: Chart is not defined
```
→ Chart.js のロードエラー

---

### 3. サーバーログ確認

Render Dashboard で：
1. `wannav-lesson-analyzer` を選択
2. **Logs** タブを開く
3. 最近のログを確認

**確認すべきログ**:
```
Dashboard server running at http://0.0.0.0:3000
```
→ サーバーが正常に起動している

---

### 4. 強制デプロイ（まだ試していない場合）

最新コードが反映されていない可能性があります：

```bash
# Render Dashboard で
1. Manual Deploy をクリック
2. "Clear build cache & deploy" を選択（重要！）
3. デプロイ完了を待つ（3-5分）
```

---

## トラブルシューティング手順

### ケース1: 404エラーが出る

**原因**: 最新コードがデプロイされていない

**解決策**:
```bash
# Render Shell で
cd /opt/render/project/src
git fetch origin
git reset --hard origin/main
npm install

# サーバーを再起動
pkill -f "node src/dashboard/server.js"
# Renderが自動で再起動します
```

### ケース2: sales.js が 404

**原因**: public/static/js/sales.js がデプロイされていない

**解決策**:
```bash
# Render Shell で
cd /opt/render/project/src

# ファイルが存在するか確認
ls -la public/static/js/sales.js

# 存在しない場合、GitHubから取得
git fetch origin
git checkout origin/main -- public/static/js/sales.js

# サーバーを再起動
pkill -f "node src/dashboard/server.js"
```

### ケース3: API エラー (sales_evaluations シート)

**原因**: Google Sheets に `sales_evaluations` シートが存在しない

**解決策**:
1. Google Sheets を開く:
   https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit

2. 新しいシート `sales_evaluations` を作成

3. ヘッダー行を追加（まだジョブ未実行の場合は空でOK）

---

## 一時的な修正（緊急）

もし上記で解決しない場合、Render Shell で直接修正：

```bash
cd /opt/render/project/src

# sales.js をコピー
cat > public/static/js/sales.js << 'EOF'
// 最小限のsales.js
console.log('Sales page loaded');

async function loadSalesSummary() {
  try {
    const response = await axios.get('/api/sales-summary');
    console.log('Sales data:', response.data);
    
    if (!response.data.success || response.data.data.length === 0) {
      document.getElementById('salesSummaryTable').innerHTML = 
        '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">データがありません</td></tr>';
      return;
    }
    
    // データを表示
    alert('Sales data loaded: ' + response.data.data.length + ' items');
  } catch (error) {
    console.error('Failed to load sales summary:', error);
  }
}

document.addEventListener('DOMContentLoaded', loadSalesSummary);
EOF

# サーバーを再起動
pkill -f "node src/dashboard/server.js"
```

---

## 確認していただきたいこと

以下を実行して、結果を教えてください：

1. **ブラウザで直接アクセス**:
   ```
   https://speech-ratio-evaluation-ai.onrender.com/sales
   ```
   → 何が表示されますか？（404? 白い画面? エラーメッセージ?）

2. **ブラウザコンソール** (F12):
   → エラーメッセージはありますか？

3. **Render Shell でコード確認**:
   ```bash
   cd /opt/render/project/src
   git log --oneline -3
   ls -la public/static/js/sales.js
   ```
   → 実行結果を教えてください

この情報で、正確な原因を特定できます！
