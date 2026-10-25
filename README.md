# WannaV レッスン分析自動化システム v3.0

Google Meet録画を自動解析し、講師のパフォーマンスと生徒の受講体験を定量化・可視化するシステムです。

## 🚨 月次サマリーが0になる問題の解決方法

**症状**: ダッシュボードで「平均発話比率: 0.0%」「平均沈黙回数: 0.0」と表示される

**即座に解決**: [QUICK_START_FIX.md](./QUICK_START_FIX.md) を参照（5分で実行、2-3時間で完了）

**詳細な手順**: [MONTHLY_SUMMARY_FIX.md](./MONTHLY_SUMMARY_FIX.md)

**デバッグツール**: Render Shellで `node debug-monthly-summary.js` を実行

## 🆕 v3.0 新機能

### 📅 月次自動評価
- **毎月末に自動実行**（23:00 JST）
- **全講師からランダムに2レッスンずつサンプリング**
- 効率的な品質モニタリング
- Daily/Weekly ジョブは廃止

### 🎲 ランダムサンプリング
- 講師ごとに今月の全動画からランダムに2件選択
- 偏りのない公平な評価
- 処理時間の大幅短縮（全レッスンの代わりにサンプルのみ）

## v2.1 機能

### ⚡ 並列処理
- **5並列で処理時間を83%削減**（420分 → 84分）
- 講師数に応じた自動並列度調整
- 環境変数 `MAX_CONCURRENCY` で調整可能

### 🔍 エラーモニタリング
- **エラー率とトレンドを可視化**
- 日別・講師別・エラー種別の集計
- コマンド: `npm run monitor:errors`

### 🎯 講師フィルター（ダッシュボード）
- **講師別のデータ表示**
- 週次サマリー・グラフ・レッスン詳細をフィルタリング
- レッスン詳細: `2026-01-08_片桐駿樹` 形式

### 🔧 音声分割処理（Gemini）
- **12分チャンクで長時間音声を分割文字起こし**
- カバレッジ: 約57-70%
- リトライ時のファイル保持・部分JSON salvage

## v2.0 機能

### ✨ Gemini AI統合
- **OpenAI→Gemini AIへ完全移行**
- 音声文字起こし: Gemini 2.5 Flash
- 分析・レポート生成: Gemini 2.5 Flash
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

### 📁 Google Drive フォルダ構造
システムは以下のフォルダ構造に対応しています：

**パターン1: yyyy-mm 形式**
```
親フォルダ (Sheet1のC列URL)
├── 2026-01/    ← yyyy-mm 形式の月別フォルダ
│   ├── lesson1.mp4
│   └── lesson2.mp4
├── 2026-02/
│   └── lesson3.mp4
└── 2025-12/
    └── lesson4.mp4
```

**パターン2: yyyy年mm月 形式（日本語）**
```
親フォルダ (Sheet1のC列URL)
├── 2026年1月/   ← yyyy年m月 形式
│   ├── lesson1.mp4
│   └── lesson2.mp4
├── 2025年12月/  ← yyyy年mm月 形式
│   └── lesson3.mp4
└── 2025年11月/
    └── lesson4.mp4
```

- **対応命名規則**: 
  - `yyyy-mm` 形式（例: `2026-01`, `2025-12`）
  - `yyyy年mm月` または `yyyy年m月` 形式（例: `2025年11月`, `2025年9月`）
- **自動検索**: 日付範囲に基づいて該当する月フォルダのみを検索
- **自動正規化**: 両パターンを自動的に `yyyy-mm` 形式に変換して処理
- **権限継承**: 親フォルダに権限を付与すれば、サブフォルダに自動継承

### 自動解析項目
- **発話比率・発話量**: 講師と生徒の発話時間比率
- **連続発話（モノローグ）**: 講師の長時間連続発話の検出
- **生徒の参加度**: 発話ターン数、沈黙回数
- **割り込み（被せ）**: 話者間の割り込み回数
- **感情シグナル**: 困惑/ストレス/ポジティブ区間の検出（TOP3）
- **改善アドバイス**: AIによる具体的な改善提案

### 出力
1. **Google Sheets**
   - monthly_lessons: レッスン詳細データ（ランダムサンプリング）
   - monthly_tutors: 講師×月別集計
   - ~~daily_lessons~~: 廃止
   - ~~daily_tutors~~: 廃止
   - ~~weekly_tutors~~: 廃止

2. **Webダッシュボード**
   - 月次スコア推移グラフ
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

# 月次ジョブ（今月分・全講師からランダム2件ずつ）
npm run monthly

# テストモード（特定月を指定）
npm run monthly:test 2026-01-15  # 2026年1月のデータを処理
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

## Render.com デプロイ（推奨）

### 📋 デプロイ手順

1. **Render Dashboard を開く**
   - https://dashboard.render.com/

2. **環境変数を設定**
   - 必須: `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_AI_API_KEY`, `TZ=Asia/Tokyo`
   - オプション: `ASSEMBLYAI_API_KEY`, `MAX_CONCURRENCY=5`

3. **自動デプロイ**
   - GitHub にプッシュすると自動的にデプロイ開始
   - ビルド時間: 約2-3分

4. **サービス起動**
   - ダッシュボード: https://speech-ratio-evaluation-ai.onrender.com
   - Cron Jobs: 自動実行（**毎月末 23:00 JST - 全講師からランダム2レッスンずつ評価**）

**詳細**: [RENDER_DEPLOY_GUIDE.md](./RENDER_DEPLOY_GUIDE.md)

---

## GitHub Actions（非推奨）

⚠️ **注意**: Render.com のデプロイを推奨します。GitHub Actions は手動トリガーのみ使用してください。

### 1. リポジトリSecretsに追加

Settings > Secrets and variables > Actions:

- `GOOGLE_SHEETS_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_AI_API_KEY`
- `ASSEMBLYAI_API_KEY` (オプション)

### 2. ワークフロー

- `.github/workflows/daily.yml`: 手動実行のみ
- `.github/workflows/weekly.yml`: 手動実行のみ

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

## SEC-007: SSO署名鍵の必須設定

ダッシュボードの起動前に`JWT_SECRET`をWannaV-mainと同じ32文字以上の十分にランダムな鍵へ設定してください。未設定・短い鍵・公開サンプル鍵は起動を拒否し、HS256以外の署名を受け付けません。`.env.example`の空欄を本番へそのまま配備しないでください。既存の安全な共有鍵は不要に交換しません。過去に公開既定鍵を使用した場合は、SSOの発行側と全受信側を調整して鍵を交換し、既存セッションを失効させて再ログインします。秘密値はソース・ログ・チャットへ記載しません。

`npm run test:security`で、鍵未設定の起動拒否・旧既定鍵署名拒否・正規HS256署名成功・期限切れと異なるアルゴリズム拒否を外部接続なしで検証します。issuer/audienceの新規導入とSSOロールの変更はこの差分に含めず、既存の発行側との契約を保持しています。実Google/Sheets/本番SSOの検証は別途必要です。

### 2026-10-25 第12バッチ依存更新

Hono/Node adapter、Axios/form-dataとテスト用依存の互換patchを既存manifest範囲内でlock更新。認証・API・業務コード・DBスキーマ・環境設定は変更しません。Node22.23.4でinstall scripts無効のclean install、4テスト、差分チェック成功。HTTP adapterの保護付き静的配信・エンコードされたパス・JSON処理は架空fixtureで検証。

稼働用audit: Critical0/High0/Moderate5/Low0。全依存audit: Critical0/High0/Moderate5/Low1。警告件数と実際の攻撃成立は別に評価します。test:securityでSSOとHTTP adapterを検証。実録画・音声解析・AI・Google通信・ジョブは未試験。

## qs互換更新（2026-10-25）

推移依存qsを6.16.1へ更新しました。manifest・アプリソース・認証・ジョブ・環境変数は変更しません。Node22.23.4でclean install(ignore-scripts)、4セキュリティテスト、dashboard構文確認成功。本番依存auditはCritical/High0、Moderate5→4（Google/uuid関連が残存）。実Google通信・AI分析・通知・本番ジョブは実行していません。

## Google APIクライアントの互換性検証

googleapisは検証済みの150.0.1に固定しています。認証スコープ・環境変数・ジョブ設定は変更していません。

npm run test:security はSSO・HTTP境界に加え、実際のSheets/DriveサービスとGoogleクライアントを使い、HTTP transportを模擬して読取り・RAW書込み・シート作成・エラー処理を検証します。実キー、外部API、AI、実データは使用しません。実Google認証や本番データの操作確認は別途必要です。
