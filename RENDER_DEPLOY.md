# Render デプロイガイド

## Renderへのデプロイ手順

### 前提条件
- ✅ GitHubリポジトリにコードがプッシュ済み
- ✅ Renderアカウント作成済み（無料でOK）
- ✅ 各種APIキーを準備

---

## デプロイ構成

Renderでは**2つのサービス**をデプロイします：

### 1. **Background Worker**（分析ジョブ実行用）
- 日次・週次ジョブを手動実行
- GitHub Actionsの代替として使用可能

### 2. **Web Service**（ダッシュボード用）
- Webダッシュボードを公開
- 常時アクセス可能なURL

---

## ステップ1: Renderアカウント作成

1. [Render](https://render.com)にアクセス
2. **Sign Up**をクリック
3. GitHubアカウントで認証（推奨）

---

## ステップ2: Web Service（ダッシュボード）のデプロイ

### 2.1 新規サービス作成

1. Renderダッシュボードで **New +** をクリック
2. **Web Service** を選択
3. GitHubリポジトリを接続:
   - **Connect Repository**: `Speech-ratio-evaluation-AI` を選択

### 2.2 サービス設定

| 設定項目 | 値 |
|---------|-----|
| **Name** | `wannav-dashboard` |
| **Region** | `Oregon (US West)` または `Singapore` |
| **Branch** | `main` |
| **Root Directory** | （空欄） |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm run dashboard` |
| **Instance Type** | `Starter` ($7/月) または `Free` |

⚠️ **重要**: Freeプランは15分アイドル後にスリープします。Starterプラン推奨。

### 2.3 環境変数設定（Render Web UI）

**Environment** セクションで以下を追加:

#### 必須の環境変数

```bash
# Google Sheets API
GOOGLE_SHEETS_ID=1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo

GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# ⚠️ 改行をそのまま保持してください
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----

# Google AI (Gemini)
GOOGLE_AI_API_KEY=AIzaSy...

# Timezone
TZ=Asia/Tokyo

# Dashboard設定
DASHBOARD_PORT=3000
DASHBOARD_HOST=0.0.0.0

# Log level
LOG_LEVEL=info
```

#### オプションの環境変数

```bash
# AssemblyAI（高精度な話者分離が必要な場合）
ASSEMBLYAI_API_KEY=your-assemblyai-api-key
```

**⚠️ GOOGLE_PRIVATE_KEY の入力方法**:
1. サービスアカウントJSONファイルから `private_key` をコピー
2. Renderの環境変数入力欄に**改行をそのまま**ペースト
3. `\n` に変換せず、実際の改行として保存

### 2.4 デプロイ実行

1. **Create Web Service** をクリック
2. 自動的にビルド＆デプロイ開始
3. ログを確認:
   ```
   ==> Downloading cache...
   ==> Installing dependencies...
   ==> Building...
   ==> Starting service...
   Dashboard server running at http://0.0.0.0:3000
   ```

### 2.5 動作確認

1. Renderが提供するURL（例: `https://wannav-dashboard.onrender.com`）にアクセス
2. ダッシュボードが表示されればOK
3. 週次評価グラフが表示されない場合 → Google Sheetsにデータがない（正常）

---

## ステップ3: Background Worker（分析ジョブ）のデプロイ

### 3.1 新規サービス作成

1. Renderダッシュボードで **New +** をクリック
2. **Background Worker** を選択
3. 同じリポジトリを選択: `Speech-ratio-evaluation-AI`

### 3.2 サービス設定

| 設定項目 | 値 |
|---------|-----|
| **Name** | `wannav-analyzer` |
| **Region** | `Oregon (US West)` または `Singapore` |
| **Branch** | `main` |
| **Root Directory** | （空欄） |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `echo "Worker ready. Run jobs manually via Shell."` |
| **Instance Type** | `Starter` ($7/月) |

⚠️ **重要**: Start Commandは常時実行しない設定にしています。

### 3.3 環境変数設定

**Web Serviceと同じ環境変数**を設定:

```bash
GOOGLE_SHEETS_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_AI_API_KEY=...
ASSEMBLYAI_API_KEY=... (オプション)
TZ=Asia/Tokyo
LOG_LEVEL=info
```

### 3.4 デプロイ実行

1. **Create Background Worker** をクリック
2. デプロイ完了を待つ

---

## ステップ4: 分析ジョブの手動実行

Render ShellまたはGitHub Actionsで実行できます。

### オプション1: Render Shellから実行（推奨）

1. Renderダッシュボードで `wannav-analyzer` サービスを開く
2. **Shell** タブをクリック
3. 以下のコマンドを実行:

#### 日次ジョブ（前日分）
```bash
npm run daily
```

#### 週次ジョブ（前週月〜日）
```bash
npm run weekly
```

#### 環境変数確認
```bash
npm run validate
```

### オプション2: GitHub Actionsから実行

1. GitHub ActionsワークフローをWeb UIから追加（前述）
2. GitHub Secretsを設定
3. Actions タブから手動実行

---

## ステップ5: スケジュール実行の設定

### オプション1: Render Cron Jobs（推奨）

Render有料プラン（$7/月〜）では**Cron Jobs**が使用可能:

1. Renderダッシュボードで **New +** → **Cron Job**
2. 設定:

#### 日次ジョブ
```
Name: wannav-daily
Schedule: 0 0 * * * (毎日00:00 UTC = 09:00 JST)
Command: npm run daily
```

#### 週次ジョブ
```
Name: wannav-weekly
Schedule: 0 0 * * 1 (毎週月曜00:00 UTC = 09:00 JST)
Command: npm run weekly
```

### オプション2: GitHub Actions（無料）

GitHub Actionsを使用（前述の手順）:
- 無料枠: 2,000分/月
- 自動スケジュール実行

---

## 環境変数の管理

### ✅ Renderで環境変数を設定するメリット

1. **セキュアな管理**: Renderが暗号化して保存
2. **簡単な更新**: Web UIから即座に変更可能
3. **サービス間共有**: 複数サービスで同じ変数を使用可能
4. **バージョン管理不要**: `.env`ファイルをGitにコミットしなくてOK

### ⚠️ 注意点

- **GOOGLE_PRIVATE_KEY**: 改行を保持する
- **変更反映**: 環境変数を変更したらサービスを再起動
- **バックアップ**: 念のため`.env`ファイルをローカルに保存

---

## ステップ6: デプロイ後の確認

### 6.1 ダッシュボード確認

1. Render提供のURL（例: `https://wannav-dashboard.onrender.com`）にアクセス
2. 週次評価セクションを確認:
   - グラフが表示されない → Google Sheetsにデータがまだない（正常）
   - エラーが表示される → 環境変数を確認

### 6.2 ジョブ実行テスト

1. Render Shell（`wannav-analyzer`）で:
   ```bash
   npm run validate
   ```
2. 環境変数が正しく設定されているか確認
3. エラーがなければ:
   ```bash
   npm run daily
   ```
4. ログを確認:
   ```
   Starting DAILY JOB
   All services initialized
   Found 2 tutor records
   Processing tutor: 山田太郎
   ...
   DAILY JOB COMPLETED SUCCESSFULLY
   ```

### 6.3 Google Sheets確認

1. スプレッドシートを開く
2. 以下のシートが自動作成されているか確認:
   - `daily_lessons`
   - `daily_tutors`
   - `weekly_tutors`（週次ジョブ実行後）

---

## トラブルシューティング

### 1. "Missing required environment variables" エラー

**原因**: 環境変数が正しく設定されていない

**解決策**:
1. Render Web UIの **Environment** タブを開く
2. すべての必須変数が設定されているか確認
3. 変更後、**Manual Deploy** → **Deploy latest commit** でサービス再起動

### 2. "Failed to initialize Google Sheets API" エラー

**原因**: `GOOGLE_PRIVATE_KEY` の改行が正しくない

**解決策**:
1. サービスアカウントJSONファイルを開く
2. `private_key` フィールドをコピー（`\n`を実際の改行として）
3. Renderの環境変数に**実際の改行として**ペースト
4. サービス再起動

### 3. ダッシュボードにデータが表示されない

**原因**: Google Sheetsにまだデータがない

**解決策**:
1. まず分析ジョブを実行: `npm run daily`
2. Google Sheetsにデータが書き込まれているか確認
3. ダッシュボードをリロード

### 4. "Port 3000 already in use" エラー

**原因**: Renderでは自動的にポートが割り当てられる

**解決策**:
- 通常は発生しません（Renderが自動管理）
- 発生した場合はRenderサポートに問い合わせ

---

## コスト見積もり

### Renderの料金プラン

#### Web Service（ダッシュボード）
- **Free**: $0/月（15分アイドルでスリープ）
- **Starter**: $7/月（常時起動、推奨）
- **Standard**: $25/月（より高性能）

#### Background Worker（分析ジョブ）
- **Starter**: $7/月（推奨）
- **Standard**: $25/月

#### Cron Jobs（スケジュール実行）
- **有料プランに含まれる**（追加料金なし）

### 推奨構成

1. **ダッシュボードのみ**: $7/月
   - Web Service (Starter)
   - 分析ジョブはGitHub Actions（無料）

2. **フル機能**: $14/月
   - Web Service (Starter): $7/月
   - Background Worker (Starter): $7/月
   - Cron Jobs含む

### API使用料（別途）

- **Gemini API**: 約$0.50/レッスン
- **AssemblyAI**: 約$0.90/レッスン（オプション）

---

## 次のステップ

1. ✅ Web Service（ダッシュボード）をデプロイ
2. ✅ Background Worker（分析ジョブ）をデプロイ
3. ✅ 環境変数をすべて設定
4. ✅ Render Shellで `npm run validate` 実行
5. ✅ Render Shellで `npm run daily` 実行してテスト
6. ✅ Google Sheetsにデータが書き込まれたか確認
7. ✅ ダッシュボードURLでデータを確認
8. ⭐ Cron Jobsを設定（自動実行）

---

## サポート

- **Renderドキュメント**: https://render.com/docs
- **プロジェクトREADME**: リポジトリの `README.md`
- **デプロイガイド**: リポジトリの `DEPLOY.md`

---

## まとめ

**はい、Renderで環境変数を設定するのは完全にOKです！**

むしろ推奨される方法です。理由:
- ✅ セキュア（暗号化保存）
- ✅ 簡単に更新可能
- ✅ `.env`ファイルをGitにコミット不要
- ✅ Web UIから管理

Renderなら、GitHub Actionsを使わずに完全に動作させることができます！
