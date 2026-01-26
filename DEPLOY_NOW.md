# 🚀 緊急デプロイ手順

## 現在の状況
- ✅ コード修正完了（月次サマリー + セールス機能）
- ✅ GitHub最新: ab8dda3
- ❌ Render未デプロイ（古いコード: 022e782）

## 最速デプロイ方法

### 方法1: Render Dashboard（推奨）

1. **Renderダッシュボードにアクセス**:
   - URL: https://dashboard.render.com/
   - プロジェクト: `wannav-lesson-analyzer` を選択

2. **手動デプロイ実行**:
   - 右上の **"Manual Deploy"** をクリック
   - **"Clear build cache & deploy"** を選択（推奨）
   - または **"Deploy latest commit"** を選択

3. **デプロイ完了を待つ**:
   - 所要時間: 約3-5分
   - "Live" ステータスが表示されるまで待機

4. **動作確認**:
   ```bash
   # ブラウザで確認
   https://speech-ratio-evaluation-ai.onrender.com
   
   # APIテスト
   curl https://speech-ratio-evaluation-ai.onrender.com/api/monthly-summary
   curl https://speech-ratio-evaluation-ai.onrender.com/api/sales-summary
   ```

5. **ブラウザ強制リロード**:
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

---

### 方法2: Render Shell（代替案）

Renderダッシュボードからうまくいかない場合のみ：

```bash
# 1. Render Shellにアクセス
https://dashboard.render.com/ → wannav-lesson-analyzer → Shell

# 2. 最新コードを取得
cd /opt/render/project/src
git fetch origin
git reset --hard origin/main

# 3. 依存関係更新
npm install

# 4. サーバー再起動
pkill -f "node src/dashboard/server.js"
# Renderが自動で再起動します
```

---

## デプロイ後の確認項目

### ダッシュボード画面（講師評価）
- [ ] 月次サマリーの値が 0.0% 以外の数値で表示される
- [ ] 色分け（緑/黄/赤）が正しく表示される
- [ ] ヘッダーにℹ️アイコンが表示される
- [ ] グラフが描画される

### セールスチーム画面（新機能）
- [ ] /sales ページにアクセスできる
- [ ] ナビゲーションメニューに「セールスチーム」タブがある
- [ ] データが表示される（初回は空の場合あり）

---

## トラブルシューティング

### Q1: まだ0.0%のままです
**A**: ブラウザキャッシュが残っている可能性があります
```
解決策:
1. Ctrl + Shift + R で強制リロード
2. ブラウザのキャッシュクリア
3. シークレットモードで開く
```

### Q2: セールスページが404エラー
**A**: デプロイが完了していない可能性があります
```
確認方法:
1. Render Dashboard → Events で "Live" を確認
2. デプロイログを確認
3. 3-5分待ってから再試行
```

### Q3: APIエラーが表示される
**A**: 環境変数を確認してください
```
必要な環境変数:
- GOOGLE_SERVICE_ACCOUNT_EMAIL
- GOOGLE_PRIVATE_KEY
- GOOGLE_SHEETS_ID

Render Dashboard → Environment で確認・設定
```

---

## 期待される結果

### 講師評価ダッシュボード
```
月次サマリーテーブル:
┌────────┬──────────┬──────┬──────┬────────┬──────┐
│ 月     │ 講師     │ 件数 │ 発話 │ 時間   │ 混乱 │
├────────┼──────────┼──────┼──────┼────────┼──────┤
│2026-01 │りょうや  │  2   │40.6% │  60秒  │30.0% │
│2026-01 │まり      │  2   │80.6% │  53秒  │25.0% │
└────────┴──────────┴──────┴──────┴────────┴──────┘
```

### セールスチーム画面
```
評価サマリー:
- 営業発話比率
- 顧客発話比率  
- 質問回数
- 感情分析
- 改善アドバイス
```

---

## さらにサポートが必要な場合

実行結果を教えてください：
1. Renderのデプロイログ（Events画面）
2. ダッシュボードのスクリーンショット
3. ブラウザのコンソールエラー（F12で確認）
