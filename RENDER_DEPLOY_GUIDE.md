# Render デプロイ手順

## 🚀 修正内容サマリー

### 1. Cron スケジュール修正
- **Daily Job**: `0 0 * * *` → `0 9 * * *` (09:00 JST)
- **Weekly Job**: `0 1 * * 1` → `0 10 * * 1` (10:00 JST Monday)

### 2. Render 設定変更
- **Service Type**: `worker` → `web` (ダッシュボード + Cron)
- **Start Command**: `node src/index.js` (ダッシュボードサーバー + スケジューラー起動)
- **環境変数**: `OPENAI_API_KEY` → `GOOGLE_AI_API_KEY`

### 3. アーキテクチャ
- **Port 3000**: ダッシュボードHTTPサーバー
- **Cron Jobs**: バックグラウンドで自動実行
  - Daily: 毎日 09:00 JST
  - Weekly: 毎週月曜日 10:00 JST

---

## 📋 Render 環境変数設定（必須）

Render Dashboard → Environment → Environment Variables で以下を設定：

### 必須環境変数
```
GOOGLE_SHEETS_ID=1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo
GOOGLE_SERVICE_ACCOUNT_EMAIL=<あなたのサービスアカウントメール>
GOOGLE_PRIVATE_KEY=<あなたのプライベートキー>
GOOGLE_AI_API_KEY=<あなたのGemini APIキー>
TZ=Asia/Tokyo
NODE_ENV=production
```

### オプション環境変数
```
ASSEMBLYAI_API_KEY=<AssemblyAI APIキー（任意）>
MAX_CONCURRENCY=5
DASHBOARD_PORT=3000
DASHBOARD_HOST=0.0.0.0
LOG_LEVEL=info
```

**重要**: 
- `GOOGLE_PRIVATE_KEY` は改行を含む場合、Renderでは `\n` を実際の改行として認識します
- 例: `-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----`

---

## 🔄 デプロイ手順

### 1. Render Dashboard を開く
https://dashboard.render.com/ にアクセス

### 2. サービスを選択
`wannav-lesson-analyzer` を選択

### 3. 環境変数を設定
- **Environment** タブを開く
- 上記の環境変数をすべて設定
- **Save Changes** をクリック

### 4. 自動デプロイ開始
- GitHubにプッシュ済みなので自動的にデプロイ開始
- **Deploy** タブでログを確認
- ビルド時間: 約2-3分

### 5. デプロイ成功の確認
ログで以下のメッセージを確認：
```
🚀 WannaV Lesson Analyzer starting...
Validating configuration...
✅ Configuration validated
Starting job scheduler...
📅 Job scheduler started with 2 jobs
✅ Job scheduler started
Starting dashboard server on 0.0.0.0:3000...
✅ Dashboard server running at http://0.0.0.0:3000
📊 Dashboard: http://localhost:3000
📅 Daily job scheduled: 09:00 JST (every day)
📅 Weekly job scheduled: 10:00 JST (every Monday)
```

### 6. サービスの状態確認
- **Status**: `Live` (緑色)
- **Last Deploy**: 最新のコミット時刻
- **Build**: `Successful`

---

## ✅ テスト手順

### 1. ダッシュボードアクセス
```
https://speech-ratio-evaluation-ai.onrender.com
```
- 週次サマリー表示を確認
- 講師フィルター機能を確認
- レッスン詳細表示を確認

### 2. Cron ジョブの動作確認

#### 明日の自動実行を待つ
- **日時**: 2026-01-14 09:00 JST
- **確認方法**: Render Logs で以下を確認
```
🕐 Daily job triggered at 09:00 JST
Spawning daily job: node /opt/render/project/src/src/jobs/daily.js
```

#### 手動テスト（任意）
ローカルで以下を実行：
```bash
npm run daily:test 2026-01-13
```

### 3. ログ確認
Render Dashboard → Logs で以下を確認：
- サービス起動ログ
- Cronジョブ実行ログ
- エラーログ（あれば）

---

## 🔧 トラブルシューティング

### ケース1: サービスが起動しない
**原因**: 環境変数が未設定
**解決**: Render Dashboard → Environment で必須環境変数をすべて設定

### ケース2: Cron ジョブが実行されない
**原因**: 
- タイムゾーン設定が間違っている
- Cron 式が間違っている

**解決**: 
- `TZ=Asia/Tokyo` を確認
- Render Logs でスケジューラー起動を確認：
  ```
  ✅ Daily job scheduled: 09:00 JST (every day)
  ✅ Weekly job scheduled: 10:00 JST (every Monday)
  ```

### ケース3: メモリ不足エラー
**原因**: 並列処理が多すぎる
**解決**: `MAX_CONCURRENCY` を 3 に下げる

### ケース4: Gemini API エラー
**原因**: API キーが間違っている、またはクォータ超過
**解決**: 
- `GOOGLE_AI_API_KEY` を確認
- Google Cloud Console でクォータを確認

---

## 📊 期待される結果

### デプロイ後の状態
- ✅ ダッシュボードが https://speech-ratio-evaluation-ai.onrender.com でアクセス可能
- ✅ 毎日 09:00 JST に自動でレッスン分析実行
- ✅ 毎週月曜日 10:00 JST に週次サマリー生成
- ✅ エラーが発生した場合はスプレッドシートに記録

### 処理性能
- **1日の処理時間**: 約1.5-2時間（5並列、35本想定）
- **カバレッジ**: 57-70%（Geminiのみ）
- **コスト**: $85/月（Render Pro）

---

## 🎯 次のステップ

1. **Render 再デプロイ**
   - Render Dashboard を開く
   - 自動デプロイ完了を待つ（約2-3分）
   - ログで `Live` を確認

2. **ダッシュボードテスト**
   - https://speech-ratio-evaluation-ai.onrender.com にアクセス
   - 講師フィルターをテスト
   - レッスン詳細をテスト

3. **明日の自動実行を確認**
   - 2026-01-14 09:00 JST に Render Logs を確認
   - スプレッドシートに新しいデータが追加されるか確認

4. **エラーモニタリング**
   - 週次でエラー率を確認: `npm run monitor:errors`

---

## 📝 注意事項

- **Render Pro プラン**: 必須（長時間実行、メモリ4GB）
- **GitHub 自動デプロイ**: 有効（main ブランチへのプッシュで自動デプロイ）
- **環境変数**: Renderで設定後、再デプロイ不要（即座に反映）
- **ログ保持期間**: Render の無料ログは7日間

---

## 🚀 完了確認チェックリスト

- [ ] Render Dashboard で環境変数をすべて設定
- [ ] 自動デプロイ完了（`Live` 状態）
- [ ] ダッシュボードにアクセス可能
- [ ] ログでスケジューラー起動を確認
- [ ] 明日 09:00 JST に自動実行を確認
- [ ] スプレッドシートに新しいデータ追加を確認

---

以上で設定は完了です！🎉
