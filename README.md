# WannaV レッスン分析自動化システム

Google Meet録画を自動解析し、講師のパフォーマンスと生徒の受講体験を定量化するシステムです。

## 主な機能

### 自動解析項目
- **発話比率・発話量**: 講師と生徒の発話時間比率
- **連続発話（モノローグ）**: 講師の長時間連続発話の検出
- **生徒の参加度**: 発話ターン数、沈黙回数
- **割り込み（被せ）**: 話者間の割り込み回数
- **感情シグナル**: 困惑/ストレス/ポジティブ区間の検出（TOP3）
- **改善アドバイス**: AIによる具体的な改善提案

### 出力シート
1. **daily_lessons**: レッスン1本＝1行の詳細データ
2. **daily_tutors**: 講師×日別の集計データ
3. **weekly_tutors**: 講師×週別のスコアと分析

## アーキテクチャ

### 技術スタック
- **Node.js 18+**: サーバーサイドランタイム
- **Google Sheets API**: データ入出力
- **Google Drive API**: 動画ファイル取得
- **OpenAI Whisper API**: 音声文字起こし
- **AssemblyAI API**: 話者分離（Diarization）
- **OpenAI GPT-4**: 感情分析・レポート生成
- **ffmpeg**: 音声抽出・前処理

### 実行環境
- **GitHub Actions**: 日次・週次スケジュール実行
- **Render (オプション)**: バックグラウンドワーカー

## セットアップ

### 1. 必要な認証情報

#### Google API
1. Google Cloud Consoleでサービスアカウントを作成
2. Google Sheets API と Google Drive API を有効化
3. サービスアカウントに以下の権限を付与:
   - スプレッドシートへの編集権限
   - 録画フォルダへの閲覧権限

#### OpenAI API
- OpenAI APIキーを取得（Whisper + GPT-4使用）

#### AssemblyAI API（推奨）
- AssemblyAI APIキーを取得（高精度な話者分離）

### 2. 環境変数設定

`.env` ファイルを作成（`.env.example` を参考）:

```bash
# Google Sheets API
GOOGLE_SHEETS_ID=1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key

# AssemblyAI API (optional but recommended)
ASSEMBLYAI_API_KEY=your-assemblyai-api-key

# Timezone
TZ=Asia/Tokyo
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

#### Windows
[ffmpeg公式サイト](https://ffmpeg.org/download.html)からダウンロード

## ローカル実行

### 日次ジョブ（前日分）
```bash
npm run daily
```

### 週次ジョブ（前週月〜日）
```bash
npm run weekly
```

## GitHub Actions デプロイ

### 1. リポジトリSecretsに追加

GitHub リポジトリの Settings > Secrets and variables > Actions で以下を追加:

- `GOOGLE_SHEETS_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `OPENAI_API_KEY`
- `ASSEMBLYAI_API_KEY`

### 2. ワークフローファイル

- `.github/workflows/daily.yml`: 毎日9:00 JST実行
- `.github/workflows/weekly.yml`: 毎週月曜9:00 JST実行

### 3. 手動実行

GitHub Actions タブから "Run workflow" で手動実行可能

## Render デプロイ（オプション）

### 1. Renderアカウント作成

[Render](https://render.com)でアカウント作成

### 2. New Worker 作成

- Connect Repository
- Environment変数を設定（上記Secretsと同じ）
- Deploy

**注意**: Renderは補助的な環境です。実際のジョブはGitHub Actionsで実行します。

## 入力データ形式

### Google Sheets: シート1

| 列 | カラム名 | 説明 |
|---|---------|------|
| C | recording_folder_url | Google Driveフォルダリンク |
| D | tutor_name | 講師名 |

例:
```
C列: https://drive.google.com/drive/folders/1ABC...
D列: 山田太郎
```

## 出力データ形式

### daily_lessons シート

レッスン1本＝1行。主要カラム:
- `drive_file_id`: ファイルID（冪等性キー）
- `talk_ratio_tutor`: 講師発話比率（0〜1）
- `max_tutor_monologue_sec`: 最長連続発話（秒）
- `student_turns`: 生徒発話ターン数
- `confusion_top3`: 困惑区間TOP3（時刻+根拠）
- `improvement_advice`: 改善アドバイス
- `status`: OK or ERROR

### daily_tutors シート

講師×日別集計。主要カラム:
- `lessons_count`: 処理レッスン数
- `avg_talk_ratio_tutor`: 平均発話比率
- `alerts`: アラート内容

### weekly_tutors シート

講師×週別集計。主要カラム:
- `weekly_score_total`: 週次スコア（0〜100）
- `score_breakdown`: スコア内訳
- `weekly_key_findings`: 主要所見
- `weekly_actions_top3`: 推奨アクションTOP3

## トラブルシューティング

### ffmpegエラー
```bash
# ffmpegがインストールされているか確認
ffmpeg -version
```

### Google API権限エラー
- サービスアカウントがスプレッドシートとフォルダに権限を持っているか確認
- Private Keyが正しくエスケープされているか確認（`\n`が必要）

### AssemblyAI未設定時
- AssemblyAI APIキーが無い場合、Whisper + 簡易話者分離にフォールバック
- 精度は低下しますが動作します

### メモリ不足
- GitHub Actionsのタイムアウトを延長（`timeout-minutes`）
- 大きな動画ファイルは分割処理を検討

## ログ確認

### ローカル
```bash
tail -f logs/combined.log
tail -f logs/error.log
```

### GitHub Actions
- Actions タブから該当ワークフローを選択
- "Upload logs" アーティファクトをダウンロード

## プロジェクト構造

```
wannav-lesson-analyzer/
├── src/
│   ├── config/          # 設定
│   ├── services/        # Google API, 音声処理, 文字起こし
│   ├── analyzers/       # KPI計算, 感情分析
│   ├── jobs/            # 日次・週次ジョブ
│   ├── utils/           # ユーティリティ
│   └── index.js         # エントリーポイント
├── .github/
│   └── workflows/       # GitHub Actions設定
├── temp/                # 一時ファイル（gitignore）
├── logs/                # ログファイル
├── package.json
└── README.md
```

## ライセンス

MIT

## サポート

問題が発生した場合は、以下を確認してください:
1. ログファイル (`logs/error.log`)
2. GitHub Actions実行ログ
3. 環境変数の設定
4. API権限とクォータ

## 今後の拡張予定

- [ ] 表情解析（顔出しレッスン対応）
- [ ] リアルタイム分析
- [ ] ダッシュボードUI
- [ ] 多言語対応
- [ ] カスタムKPI設定
