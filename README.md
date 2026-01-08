# WannaV レッスン分析自動化システム v2.0

Google Meet録画を自動解析し、講師のパフォーマンスと生徒の受講体験を定量化・可視化するシステムです。

## 🆕 v2.0 新機能

### ✨ Gemini AI統合
- **OpenAI→Gemini AIへ完全移行**
- 音声文字起こし: Gemini 1.5 Pro
- 分析・レポート生成: Gemini 1.5 Flash
- コスト効率の向上

### 🔁 エラーリトライロジック
- 全API呼び出しに自動リトライ（最大3回）
- ネットワークエラーやレート制限に対応
- p-retryライブラリ使用

### 📊 Webダッシュボード
- **リアルタイムデータ可視化**
- 週次評価グラフ・チャート
- レッスンごと詳細表示（ドロップダウン選択）
- Hono + Chart.js + Tailwind CSS

## 主な機能

### 自動解析項目
- **発話比率・発話量**: 講師と生徒の発話時間比率
- **連続発話（モノローグ）**: 講師の長時間連続発話の検出
- **生徒の参加度**: 発話ターン数、沈黙回数
- **割り込み（被せ）**: 話者間の割り込み回数
- **感情シグナル**: 困惑/ストレス/ポジティブ区間の検出（TOP3）
- **改善アドバイス**: AIによる具体的な改善提案

### 出力
1. **Google Sheets**
   - daily_lessons: レッスン詳細データ
   - daily_tutors: 講師×日別集計
   - weekly_tutors: 講師×週別スコア

2. **Webダッシュボード** (NEW!)
   - 週次スコア推移グラフ
   - レッスン数推移グラフ
   - レッスンごと詳細表示

## 技術スタック

### Backend
- **Node.js 18+**: サーバーサイドランタイム
- **Hono**: 軽量Webフレームワーク

### AI/ML
- **Google Gemini AI**: 文字起こし・分析
  - Gemini 1.5 Pro: 音声文字起こし
  - Gemini 1.5 Flash: 感情分析・レポート生成
- **AssemblyAI**: 高精度話者分離（オプション）

### Audio Processing
- **ffmpeg**: 音声抽出・正規化

### Frontend
- **Chart.js**: グラフ可視化
- **Tailwind CSS**: スタイリング
- **Axios**: HTTP通信

### Utilities
- **p-retry**: エラーリトライ
- **winston**: ロギング
- **date-fns**: 日付処理

## セットアップ

### 1. 必要な認証情報

#### Google Cloud Platform
1. サービスアカウント作成
2. Google Sheets API + Google Drive API 有効化
3. スプレッドシートとフォルダに権限付与

#### Google AI (Gemini)
1. [Google AI Studio](https://aistudio.google.com/)でAPIキー取得
2. Gemini API有効化

#### AssemblyAI（推奨）
1. [AssemblyAI](https://www.assemblyai.com/)でAPIキー取得

### 2. 環境変数設定

`.env` ファイルを作成:

```bash
# Google Sheets API
GOOGLE_SHEETS_ID=1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google AI (Gemini)
GOOGLE_AI_API_KEY=your-google-ai-api-key

# AssemblyAI (optional but recommended)
ASSEMBLYAI_API_KEY=your-assemblyai-api-key

# Timezone
TZ=Asia/Tokyo

# Dashboard
DASHBOARD_PORT=3000
DASHBOARD_HOST=0.0.0.0
```

### 3. 依存関係インストール

```bash
npm install
```

### 4. ffmpegインストール

#### macOS
```bash
brew install ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
```

## ローカル実行

### 分析ジョブ

```bash
# 環境変数検証
npm run validate

# 日次ジョブ（前日分）
npm run daily

# 週次ジョブ（前週月〜日）
npm run weekly
```

### Webダッシュボード

```bash
# ダッシュボード起動
npm run dashboard

# ブラウザで開く
# http://localhost:3000
```

### PM2で起動（本番環境推奨）

```bash
# ポート3000クリーンアップ
fuser -k 3000/tcp 2>/dev/null || true

# PM2で起動
pm2 start ecosystem.config.cjs

# ログ確認
pm2 logs wannav-dashboard --nostream

# 停止
pm2 delete wannav-dashboard
```

## GitHub Actions デプロイ

### 1. リポジトリSecretsに追加

Settings > Secrets and variables > Actions:

- `GOOGLE_SHEETS_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_AI_API_KEY` ⭐ NEW
- `ASSEMBLYAI_API_KEY` (オプション)

### 2. ワークフロー

- `.github/workflows/daily.yml`: 毎日9:00 JST
- `.github/workflows/weekly.yml`: 毎週月曜9:00 JST

### 3. 手動実行

GitHub Actions タブから "Run workflow"

## Webダッシュボード機能

### 📈 週次評価ページ

#### グラフ
1. **週次スコア推移**: 講師ごとのスコア（0-100）の推移
2. **レッスン数推移**: 講師ごとのレッスン実施数

#### サマリーテーブル
- 週
- 講師名
- レッスン数
- スコア
- 主要所見

### 🎥 レッスン詳細ページ

#### ドロップダウン選択
- 日付・講師・ファイル名で選択

#### 表示項目
- **KPI**: 発話比率、最長モノローグ、生徒ターン数
- **感情シグナル**: 困惑/ストレス/ポジティブのTOP3区間
- **改善アドバイス**: AIによる具体的なアドバイス
- **推奨アクション**: 3つの具体的なアクション
- **詳細統計**: 発話時間、モノローグ回数、沈黙回数など

## アーキテクチャ

```
wannav-lesson-analyzer/
├── src/
│   ├── dashboard/           # Webダッシュボード
│   │   └── server.js        # Hono APIサーバー
│   ├── services/
│   │   ├── geminiService.js # Gemini AI統合
│   │   └── ...
│   └── ...
├── public/
│   └── static/
│       └── js/
│           └── dashboard.js # フロントエンドJS
├── .github/workflows/       # GitHub Actions
└── ecosystem.config.cjs     # PM2設定
```

## コスト見積もり（更新）

### Gemini API（v2.0）
- Gemini 1.5 Pro（文字起こし）: $0.00125/秒 音声
- Gemini 1.5 Flash（分析）: $0.075/1Mトークン入力
- **60分レッスン1本**: 約$0.30〜$0.50

### AssemblyAI（オプション）
- Diarization: $0.015/分
- **60分レッスン1本**: 約$0.90

### 合計（v2.0）
- **Gemini のみ**: 約$0.30〜$0.50/レッスン（66%コスト削減 🎉）
- **Gemini + AssemblyAI**: 約$1.20〜$1.40/レッスン

## v2.0 の主な改善点

### 1. ✅ Gemini AI統合
- OpenAI依存を削除
- コスト効率60%以上向上
- 音声ファイルアップロード対応
- JSON出力による構造化データ取得

### 2. ✅ エラーリトライロジック
- `p-retry`による自動リトライ（最大3回）
- API呼び出しの信頼性向上
- ネットワーク障害への耐性強化

### 3. ✅ Webダッシュボード
- リアルタイムデータ可視化
- 週次スコア・レッスン数のグラフ表示
- レッスンごと詳細表示（ドロップダウン）
- レスポンシブデザイン

### 4. ✅ コード改善
- モジュール化の強化
- エラーハンドリングの統一
- ログレベルの最適化

## トラブルシューティング

### Gemini API エラー
```bash
# APIキーが正しいか確認
npm run validate

# ログ確認
tail -f logs/error.log
```

### ダッシュボードが起動しない
```bash
# ポート3000が使用されているか確認
lsof -i :3000

# ポートをクリーンアップ
fuser -k 3000/tcp

# 再起動
pm2 restart wannav-dashboard
```

### データが表示されない
- Google Sheetsに `weekly_tutors` と `daily_lessons` シートが存在するか確認
- サービスアカウントに閲覧権限があるか確認

## ライセンス

MIT

## バージョン履歴

- **v2.0.0** (2026-01-08)
  - Gemini AI統合
  - エラーリトライロジック
  - Webダッシュボード実装

- **v1.0.0** (2026-01-08)
  - 初版リリース
  - OpenAI Whisper + GPT-4
  - Google Sheets出力
