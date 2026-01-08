# デプロイガイド v2.0

## v2.0 変更点

### ✅ Gemini AI統合
- **OpenAI → Google Gemini AI**へ完全移行
- APIキーが`GOOGLE_AI_API_KEY`に変更

### ✅ Webダッシュボード追加
- ポート3000でHonoサーバー起動
- PM2による本番環境デプロイ

## 前提条件

1. **Google Cloud Platform アカウント**
   - サービスアカウント作成
   - Google Sheets API有効化
   - Google Drive API有効化

2. **Google AI (Gemini) アカウント** ⭐ NEW
   - [Google AI Studio](https://aistudio.google.com/)
   - APIキー取得

3. **AssemblyAI アカウント（推奨）**
   - APIキー取得
   - 課金設定

4. **GitHubアカウント**
   - リポジトリ作成
   - Actions有効化

## ステップ1: Google AI (Gemini) セットアップ ⭐ NEW

### 1.1 APIキー取得

1. [Google AI Studio](https://aistudio.google.com/)にアクセス
2. 「Get API Key」をクリック
3. APIキーをコピー（例: `AIzaSy...`）

### 1.2 利用制限

- **無料枠**: 15 requests/分、1500 requests/日
- **有料プラン**: 利用量に応じた従量課金

詳細: [Gemini API Pricing](https://ai.google.dev/pricing)

## ステップ2: Google Sheets/Drive API セットアップ

### 2.1 サービスアカウント作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新規プロジェクトを作成（または既存プロジェクトを選択）
3. 「IAMと管理」→「サービスアカウント」
4. 「サービスアカウントを作成」
   - 名前: `wannav-lesson-analyzer`
   - 説明: `WannaV Lesson Analyzer Service Account`
5. 「キーを作成」→「JSON」
   - ダウンロードしたJSONファイルを安全に保管

### 2.2 API有効化

1. 「APIとサービス」→「ライブラリ」
2. 以下を有効化:
   - Google Sheets API
   - Google Drive API

### 2.3 権限付与

#### Google Sheets
1. 対象スプレッドシートを開く
2. 「共有」ボタンをクリック
3. サービスアカウントのメールアドレスを追加
4. 権限: 「編集者」

#### Google Drive
1. 録画フォルダを開く
2. 「共有」ボタンをクリック
3. サービスアカウントのメールアドレスを追加
4. 権限: 「閲覧者」（読み取り専用）

## ステップ3: GitHubリポジトリセットアップ

### 3.1 リポジトリ作成

```bash
# ローカルでリモート設定
cd /home/user/webapp
git remote add origin https://github.com/YOUR_USERNAME/wannav-lesson-analyzer.git
```

### 3.2 Secretsの設定

GitHub リポジトリの Settings > Secrets and variables > Actions

以下のSecretsを追加:

#### GOOGLE_SHEETS_ID
```
1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo
```

#### GOOGLE_SERVICE_ACCOUNT_EMAIL
サービスアカウントのJSONファイルから `client_email` をコピー:
```
wannav-lesson-analyzer@YOUR_PROJECT.iam.gserviceaccount.com
```

#### GOOGLE_PRIVATE_KEY
サービスアカウントのJSONファイルから `private_key` をコピー:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----
```

**重要**: 改行をそのままコピーしてください（`\n`ではなく実際の改行）

#### GOOGLE_AI_API_KEY ⭐ NEW
Google AI Studioで取得したAPIキー:
```
AIzaSy...
```

#### ASSEMBLYAI_API_KEY（オプション）
```
your-assemblyai-api-key
```

### 3.3 Actionsの有効化

1. GitHub リポジトリの「Actions」タブ
2. 「I understand my workflows, go ahead and enable them」をクリック

## ステップ4: 分析ジョブのテスト実行

### 4.1 GitHub Actionsで手動実行

1. 「Actions」タブ
2. 「Daily Lesson Analysis」を選択
3. 「Run workflow」→「Run workflow」

### 4.2 ログ確認

- 実行中のワークフローをクリック
- 「analyze」ジョブを展開
- 各ステップのログを確認

### 4.3 成功確認

1. Google Sheetsを開く
2. `daily_lessons` シートが作成されているか確認
3. データが書き込まれているか確認

## ステップ5: Webダッシュボードのデプロイ ⭐ NEW

### オプション1: ローカル開発

```bash
cd /home/user/webapp

# 環境変数設定（.env作成）
cp .env.example .env
# .envを編集してAPIキーを設定

# 依存関係インストール
npm install

# ダッシュボード起動
npm run dashboard

# ブラウザで開く
# http://localhost:3000
```

### オプション2: PM2で本番デプロイ

```bash
# ポート3000クリーンアップ
fuser -k 3000/tcp 2>/dev/null || true

# PM2で起動
pm2 start ecosystem.config.cjs

# 起動確認
pm2 list

# ログ確認
pm2 logs wannav-dashboard --nostream

# PM2を自動起動設定（システム起動時）
pm2 startup
pm2 save

# 停止
pm2 stop wannav-dashboard

# 削除
pm2 delete wannav-dashboard
```

### オプション3: Renderにデプロイ

1. [Render](https://render.com)でアカウント作成
2. New > Web Service
3. Connect Repository: `wannav-lesson-analyzer`
4. 設定:
   - Name: `wannav-dashboard`
   - Build Command: `npm install`
   - Start Command: `npm run dashboard`
   - Environment Variables:
     - `GOOGLE_SHEETS_ID`
     - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
     - `GOOGLE_PRIVATE_KEY`
     - `GOOGLE_AI_API_KEY`
     - `DASHBOARD_PORT` = `3000`
     - `TZ` = `Asia/Tokyo`

5. Create Web Service

## ステップ6: スケジュール確認

### 日次ジョブ
- 実行時刻: 毎日 9:00 JST（00:00 UTC）
- 対象: 前日 00:00:00〜23:59:59 JST
- 処理: 動画ファイルの文字起こし・分析

### 週次ジョブ
- 実行時刻: 毎週月曜 9:00 JST（00:00 UTC）
- 対象: 前週月〜日
- 処理: 週次集計・スコア計算

### Webダッシュボード
- 常時起動（PM2またはRender）
- リアルタイムでSheets データを取得・表示

## Webダッシュボード機能

### 📈 週次評価
- **スコア推移グラフ**: 講師ごとの週次スコア（0-100）の折れ線グラフ
- **レッスン数グラフ**: 講師ごとのレッスン実施数の棒グラフ
- **サマリーテーブル**: 週、講師、レッスン数、スコア、主要所見

### 🎥 レッスン詳細
- **ドロップダウン選択**: 日付・講師・ファイル名で検索
- **KPIカード**: 発話比率、最長モノローグ、生徒ターン数
- **感情シグナル**: 困惑/ストレス/ポジティブのTOP3区間
- **改善アドバイス**: AIによる具体的なフィードバック
- **推奨アクション**: 3つの実行可能なアクション
- **詳細統計**: 全KPIの数値表示

## トラブルシューティング

### 1. "GOOGLE_AI_API_KEY not configured" エラー

**原因**: Gemini APIキーが設定されていない

**解決策**:
1. GitHub Secrets に `GOOGLE_AI_API_KEY` を追加
2. ローカルの場合は `.env` ファイルに追加
3. `npm run validate` で確認

### 2. Gemini API rate limit エラー

**原因**: 無料枠の制限（15 req/分、1500 req/日）

**解決策**:
1. エラーリトライロジックが自動的に再試行（最大3回）
2. 有料プランへのアップグレードを検討
3. レッスン処理を分散させる

### 3. ダッシュボードにデータが表示されない

**原因**: Sheetsにデータがない、または権限不足

**解決策**:
1. Google Sheets に `daily_lessons` と `weekly_tutors` シートが存在するか確認
2. サービスアカウントに閲覧権限があるか確認
3. ブラウザのコンソールでAPIエラーを確認（F12）

### 4. "Port 3000 already in use" エラー

**原因**: ポート3000が既に使用されている

**解決策**:
```bash
# プロセスを確認
lsof -i :3000

# ポートを強制的にクリーンアップ
fuser -k 3000/tcp

# または別のポートを使用
DASHBOARD_PORT=3001 npm run dashboard
```

## セキュリティ上の注意

1. **Secretsを絶対にコミットしない**
   - `.env` ファイルは `.gitignore` に含まれている
   - GitHub Secretsは暗号化されている

2. **APIキーの管理**
   - Gemini APIキー: Google AI Studio で管理
   - 定期的にローテーション推奨

3. **サービスアカウントの権限を最小限に**
   - Google Sheets: 編集者
   - Google Drive: 閲覧者のみ

4. **ダッシュボードのセキュリティ**
   - 本番環境では認証機能の追加を推奨（将来実装）
   - HTTPSの使用を推奨

## コスト見積もり（v2.0）

### Gemini API（v2.0） ⭐ 大幅コスト削減
- Gemini 1.5 Pro（文字起こし）: $0.00125/秒
- Gemini 1.5 Flash（分析）: $0.075/1M入力トークン
- **60分レッスン1本**: 約$0.30〜$0.50

### AssemblyAI API（オプション）
- Diarization: $0.015/分
- **60分レッスン1本**: 約$0.90

### 合計（v2.0）
- **Gemini のみ**: 約$0.30〜$0.50/レッスン（**66%削減** 🎉）
- **Gemini + AssemblyAI**: 約$1.20〜$1.40/レッスン

### 月間コスト（例: 20レッスン/日 × 30日 = 600レッスン/月）
- **Gemini のみ**: $180〜$300/月
- **Gemini + AssemblyAI**: $720〜$840/月

### GitHub Actions
- 無料枠: 2,000分/月（Freeプラン）
- レッスン1本処理時間: 約5〜10分
- 無料枠内で月200〜400レッスン処理可能

### Render（Webダッシュボード）
- Starter: $7/月
- Standard: $25/月（推奨）

## 次のステップ

1. ✅ Google AI (Gemini) APIキーを取得
2. ✅ GitHub Secretsを設定
3. ✅ GitHub Actionsで手動実行
4. ✅ 結果をGoogle Sheetsで確認
5. ✅ Webダッシュボードをデプロイ
6. ✅ ダッシュボードでデータ可視化を確認
7. 📊 スケジュール実行を待つ（または手動実行を続ける）

## サポート

問題が発生した場合:
1. GitHub Actionsのログを確認
2. `logs/error.log` を確認
3. このドキュメントのトラブルシューティングセクションを参照
4. ブラウザのコンソールログを確認（ダッシュボード関連）

## バージョン履歴

- **v2.0.0** (2026-01-08)
  - Gemini AI統合（66%コスト削減）
  - エラーリトライロジック実装
  - Webダッシュボード追加
  - 週次評価グラフ・チャート実装
  - レッスンごと詳細表示実装

- **v1.0.0** (2026-01-08)
  - 初版リリース
  - OpenAI Whisper + GPT-4
  - Google Sheets出力
