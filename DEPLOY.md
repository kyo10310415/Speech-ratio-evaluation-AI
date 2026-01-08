# デプロイガイド

## 前提条件

1. **Google Cloud Platform アカウント**
   - サービスアカウント作成
   - Google Sheets API有効化
   - Google Drive API有効化

2. **OpenAI アカウント**
   - APIキー取得
   - 課金設定

3. **AssemblyAI アカウント（推奨）**
   - APIキー取得
   - 課金設定

4. **GitHubアカウント**
   - リポジトリ作成
   - Actions有効化

## ステップ1: Google APIセットアップ

### 1.1 サービスアカウント作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新規プロジェクトを作成（または既存プロジェクトを選択）
3. 「IAMと管理」→「サービスアカウント」
4. 「サービスアカウントを作成」
   - 名前: `wannav-lesson-analyzer`
   - 説明: `WannaV Lesson Analyzer Service Account`
5. 「キーを作成」→「JSON」
   - ダウンロードしたJSONファイルを安全に保管

### 1.2 API有効化

1. 「APIとサービス」→「ライブラリ」
2. 以下を有効化:
   - Google Sheets API
   - Google Drive API

### 1.3 権限付与

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

## ステップ2: GitHubリポジトリセットアップ

### 2.1 リポジトリ作成

```bash
# ローカルでリポジトリを確認
cd /home/user/webapp
git remote -v

# まだリモートが設定されていない場合
git remote add origin https://github.com/YOUR_USERNAME/wannav-lesson-analyzer.git
```

### 2.2 Secretsの設定

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

#### OPENAI_API_KEY
```
sk-proj-...
```

#### ASSEMBLYAI_API_KEY（オプション）
```
your-assemblyai-api-key
```

### 2.3 Actionsの有効化

1. GitHub リポジトリの「Actions」タブ
2. 「I understand my workflows, go ahead and enable them」をクリック

## ステップ3: GitHub Actionsでテスト実行

### 3.1 手動実行

1. 「Actions」タブ
2. 「Daily Lesson Analysis」を選択
3. 「Run workflow」→「Run workflow」

### 3.2 ログ確認

- 実行中のワークフローをクリック
- 「analyze」ジョブを展開
- 各ステップのログを確認

### 3.3 成功確認

1. Google Sheetsを開く
2. `daily_lessons` シートが作成されているか確認
3. データが書き込まれているか確認

## ステップ4: Renderデプロイ（オプション）

Renderは補助的な環境です。主要な処理はGitHub Actionsで実行されます。

### 4.1 Renderアカウント作成

1. [Render](https://render.com)でサインアップ
2. GitHubアカウントと連携

### 4.2 New Workerの作成

1. Dashboard > New > Worker
2. Connect Repository: `wannav-lesson-analyzer`
3. Name: `wannav-lesson-analyzer`
4. Environment: `Node`
5. Build Command: `npm install`
6. Start Command: `echo "Worker ready"`

### 4.3 Environment変数設定

以下の環境変数を追加（GitHub Actionsと同じ値）:

- `GOOGLE_SHEETS_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `OPENAI_API_KEY`
- `ASSEMBLYAI_API_KEY`
- `TZ` = `Asia/Tokyo`

### 4.4 Deploy

「Create Worker」をクリック

## ステップ5: スケジュール確認

### 日次ジョブ
- 実行時刻: 毎日 9:00 JST（00:00 UTC）
- 対象: 前日 00:00:00〜23:59:59 JST

### 週次ジョブ
- 実行時刻: 毎週月曜 9:00 JST（00:00 UTC）
- 対象: 前週月〜日

## トラブルシューティング

### 1. "Missing required environment variables" エラー

**原因**: GitHub Secretsが正しく設定されていない

**解決策**:
1. Settings > Secrets and variables > Actions で確認
2. 各Secretが正しく設定されているか確認
3. `GOOGLE_PRIVATE_KEY` の改行が正しいか確認

### 2. "Permission denied" エラー

**原因**: サービスアカウントに権限がない

**解決策**:
1. Google Sheetsの共有設定を確認
2. Google Driveフォルダの共有設定を確認
3. サービスアカウントのメールアドレスが正しいか確認

### 3. "Failed to extract audio" エラー

**原因**: ffmpegのインストール失敗

**解決策**:
- GitHub Actionsの場合: `.github/workflows/daily.yml` で `apt-get install ffmpeg` を確認
- ローカルの場合: `ffmpeg -version` で確認

### 4. "No utterances detected" エラー

**原因**: 音声品質が低い、または音声が含まれていない

**解決策**:
1. 録画ファイルに音声が含まれているか確認
2. AssemblyAI APIキーを設定して精度を向上
3. 音声正規化のパラメータを調整（`audioService.js`）

### 5. OpenAI API rate limit エラー

**原因**: OpenAI APIのレート制限

**解決策**:
1. OpenAIダッシュボードで使用状況を確認
2. 課金プランをアップグレード
3. リトライロジックを実装（今後の改善）

## セキュリティ上の注意

1. **Secretsを絶対にコミットしない**
   - `.env` ファイルは `.gitignore` に含まれている
   - GitHub Secretsは暗号化されている

2. **サービスアカウントの権限を最小限に**
   - Google Sheets: 編集者
   - Google Drive: 閲覧者のみ

3. **Private Keyの管理**
   - ダウンロードしたJSONファイルを安全に保管
   - 不要になったら削除

4. **APIキーのローテーション**
   - 定期的にAPIキーを更新
   - 古いキーは無効化

## コスト見積もり

### OpenAI API
- Whisper: $0.006 / 分
- GPT-4o-mini: $0.15 / 1Mトークン
- 60分レッスン1本あたり: 約$0.50〜$1.00

### AssemblyAI API
- Diarization: $0.015 / 分（推奨）
- 60分レッスン1本あたり: 約$0.90

### GitHub Actions
- 無料枠: 2,000分/月（Freeプラン）
- レッスン1本処理時間: 約5〜10分
- 無料枠内で月200〜400レッスン処理可能

### Render
- Starter: $7/月（オプション）

## 次のステップ

1. ✅ 環境変数を設定
2. ✅ GitHub Actionsで手動実行
3. ✅ 結果をGoogle Sheetsで確認
4. ✅ スケジュール実行を待つ（または手動実行を続ける）
5. 📊 データ分析とダッシュボード構築（将来）

## サポート

問題が発生した場合:
1. GitHub Actionsのログを確認
2. `logs/error.log` を確認
3. このドキュメントのトラブルシューティングセクションを参照
