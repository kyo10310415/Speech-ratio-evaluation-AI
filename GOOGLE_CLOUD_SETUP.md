# Google Cloud Console API設定ガイド

## 必要なAPI一覧

このプロジェクトで**有効化が必要なAPI**は以下の通りです：

---

## ✅ 必須API（3つ）

### 1. Google Sheets API
- **API名**: `Google Sheets API`
- **用途**: スプレッドシートへのデータ読み書き
- **必須度**: ⭐⭐⭐ 必須

### 2. Google Drive API
- **API名**: `Google Drive API`
- **用途**: 録画動画ファイルのダウンロード
- **必須度**: ⭐⭐⭐ 必須

### 3. Service Usage API
- **API名**: `Service Usage API`
- **用途**: APIの使用状況確認（自動有効化される場合もある）
- **必須度**: ⭐⭐ 推奨

---

## 🔧 API有効化の手順

### ステップ1: Google Cloud Consoleにアクセス

1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. Googleアカウントでログイン

### ステップ2: プロジェクトの選択または作成

#### 既存プロジェクトがある場合
1. 画面上部のプロジェクト選択ドロップダウンをクリック
2. 使用するプロジェクトを選択

#### 新規プロジェクトを作成する場合
1. 画面上部のプロジェクト選択ドロップダウンをクリック
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: `wannav-lesson-analyzer`）
4. 「作成」をクリック

### ステップ3: APIの有効化

#### 方法1: 検索から有効化（推奨）

1. 左側のメニューから **「APIとサービス」** → **「ライブラリ」** をクリック

2. **Google Sheets API を有効化**
   - 検索ボックスに `sheets` と入力
   - 「Google Sheets API」をクリック
   - **「有効にする」** をクリック
   - ✅ 有効化完了

3. **Google Drive API を有効化**
   - 戻るボタンでライブラリに戻る
   - 検索ボックスに `drive` と入力
   - 「Google Drive API」をクリック
   - **「有効にする」** をクリック
   - ✅ 有効化完了

4. **Service Usage API を有効化**（オプション）
   - 戻るボタンでライブラリに戻る
   - 検索ボックスに `service usage` と入力
   - 「Service Usage API」をクリック
   - **「有効にする」** をクリック
   - ✅ 有効化完了

#### 方法2: 直接リンクから有効化

以下のリンクを**Ctrl+クリック**で新しいタブで開き、「有効にする」をクリック：

1. [Google Sheets API 有効化](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
2. [Google Drive API 有効化](https://console.cloud.google.com/apis/library/drive.googleapis.com)
3. [Service Usage API 有効化](https://console.cloud.google.com/apis/library/serviceusage.googleapis.com)

### ステップ4: 有効化の確認

1. 左側のメニューから **「APIとサービス」** → **「有効なAPIとサービス」** をクリック
2. 以下が表示されていればOK:
   - ✅ Google Sheets API
   - ✅ Google Drive API
   - ✅ Service Usage API（オプション）

---

## 🔑 サービスアカウントの作成

APIを有効化したら、次はサービスアカウントを作成します。

### ステップ1: サービスアカウントを作成

1. 左側のメニューから **「IAMと管理」** → **「サービスアカウント」** をクリック
2. **「サービスアカウントを作成」** をクリック
3. サービスアカウント情報を入力:
   ```
   サービスアカウント名: wannav-lesson-analyzer
   サービスアカウントID: wannav-lesson-analyzer（自動入力）
   説明: WannaV Lesson Analyzer Service Account
   ```
4. **「作成して続行」** をクリック
5. ロール選択画面では **スキップ**（「続行」または「完了」をクリック）
6. **「完了」** をクリック

### ステップ2: 認証キー（JSONファイル）を作成

1. 作成したサービスアカウントの右側の **「︙」（3点メニュー）** をクリック
2. **「鍵を管理」** を選択
3. **「鍵を追加」** → **「新しい鍵を作成」** をクリック
4. キーのタイプで **「JSON」** を選択
5. **「作成」** をクリック
6. JSONファイルが自動的にダウンロードされます
   - ⚠️ **このファイルを安全に保管してください**
   - ファイル名例: `wannav-lesson-analyzer-abc123.json`

### ステップ3: JSONファイルの内容確認

ダウンロードしたJSONファイルを開くと、以下のような内容が含まれています：

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n",
  "client_email": "wannav-lesson-analyzer@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

**環境変数に設定する値**:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` → `client_email` の値
- `GOOGLE_PRIVATE_KEY` → `private_key` の値（改行をそのまま保持）

---

## 📊 Google Sheets/Drive への権限付与

サービスアカウントを作成したら、スプレッドシートとDriveフォルダに権限を付与します。

### ステップ1: Google Sheets に権限付与

1. 対象のスプレッドシートを開く:
   ```
   https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit
   ```

2. 右上の **「共有」** ボタンをクリック

3. サービスアカウントのメールアドレスを入力:
   ```
   wannav-lesson-analyzer@your-project.iam.gserviceaccount.com
   ```
   （JSONファイルの `client_email` の値）

4. 権限を **「編集者」** に設定

5. **「送信」** をクリック
   - ⚠️ 「通知を送信」のチェックは外してOK

6. ✅ 権限付与完了

### ステップ2: Google Drive に権限付与

1. 録画が保存されているDriveフォルダを開く
   - 例: `シート1` のC列に記載されているフォルダURL

2. フォルダ名を右クリック → **「共有」** を選択

3. サービスアカウントのメールアドレスを入力:
   ```
   wannav-lesson-analyzer@your-project.iam.gserviceaccount.com
   ```

4. 権限を **「閲覧者」** に設定
   - ⚠️ 編集権限は不要（読み取り専用でOK）

5. **「送信」** をクリック

6. ✅ 権限付与完了

**⚠️ 重要**: 複数のフォルダがある場合、すべてのフォルダに権限を付与してください。

---

## 🤖 Google AI (Gemini) API キーの取得

### ステップ1: Google AI Studio にアクセス

1. [Google AI Studio](https://aistudio.google.com/) を開く
2. Googleアカウントでログイン

### ステップ2: APIキーを作成

1. 左側のメニューから **「Get API key」** をクリック
2. **「Create API key」** をクリック
3. プロジェクトを選択:
   - 既存プロジェクトを使用する場合: **「Create API key in existing project」**
   - 新規プロジェクトを作成する場合: **「Create API key in new project」**
4. APIキーが表示されます（例: `AIzaSy...`）
5. **「Copy」** でコピー
6. ✅ APIキー取得完了

**⚠️ 重要**: このAPIキーを安全に保管してください。

### ステップ3: 環境変数に設定

```bash
GOOGLE_AI_API_KEY=AIzaSy...
```

---

## 🎯 完全チェックリスト

### Google Cloud Console

- [ ] プロジェクトを作成または選択
- [ ] **Google Sheets API** を有効化
- [ ] **Google Drive API** を有効化
- [ ] **Service Usage API** を有効化（オプション）
- [ ] サービスアカウントを作成
- [ ] 認証キー（JSON）をダウンロード

### 権限付与

- [ ] Google Sheets にサービスアカウントを「編集者」として追加
- [ ] Google Drive フォルダにサービスアカウントを「閲覧者」として追加
- [ ] （複数フォルダがある場合）すべてのフォルダに権限付与

### Google AI Studio

- [ ] Google AI Studio にアクセス
- [ ] Gemini APIキーを作成
- [ ] APIキーをコピーして保存

### 環境変数

- [ ] `GOOGLE_SHEETS_ID` をコピー（スプレッドシートURLから）
- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` をコピー（JSONファイルから）
- [ ] `GOOGLE_PRIVATE_KEY` をコピー（JSONファイルから、改行保持）
- [ ] `GOOGLE_AI_API_KEY` をコピー（Google AI Studioから）

---

## 🔍 トラブルシューティング

### Q: "API not enabled" エラーが出る

**A**: APIが正しく有効化されていません。

1. [有効なAPIとサービス](https://console.cloud.google.com/apis/dashboard)を開く
2. Google Sheets API と Google Drive API が表示されているか確認
3. 表示されていない場合は再度有効化

### Q: "Permission denied" エラーが出る

**A**: サービスアカウントに権限が付与されていません。

1. Google Sheets の「共有」設定を確認
2. サービスアカウントのメールアドレスが「編集者」として追加されているか確認
3. Google Drive フォルダの「共有」設定も確認

### Q: サービスアカウントのメールアドレスがわからない

**A**: JSONファイルを確認してください。

```bash
# JSONファイルを開いて確認
cat wannav-lesson-analyzer-*.json | grep client_email
```

または：

1. Google Cloud Console → IAMと管理 → サービスアカウント
2. 作成したサービスアカウントのメールアドレスをコピー

### Q: Gemini APIキーの使用量を確認したい

**A**: Google AI Studio で確認できます。

1. [Google AI Studio](https://aistudio.google.com/)
2. 左側メニュー → **「Get API key」**
3. 既存のキーをクリック → 使用量が表示される

---

## 📊 API使用量とクォータ

### Google Sheets API
- **無料クォータ**: 1日あたり500回の読み取り、100回の書き込み
- **このプロジェクトでの使用**: 1日あたり約10-50回（問題なし）

### Google Drive API
- **無料クォータ**: 1日あたり1,000回のダウンロード
- **このプロジェクトでの使用**: レッスン数に依存（20レッスン/日なら問題なし）

### Gemini API
- **無料枠**: 15 requests/分、1,500 requests/日
- **有料プラン**: 従量課金（約$0.50/レッスン）

---

## 💰 コスト見積もり

### Google Cloud
- **APIの使用**: 無料（上記クォータ内であれば）
- **ストレージ**: 無料（APIのみの使用）

### Gemini API
- **無料枠**: 1日1,500リクエスト
- **有料**: 約$0.50/レッスン × レッスン数

---

## 🎊 まとめ

### 有効化が必要なAPI（3つ）

1. ✅ **Google Sheets API** - スプレッドシート読み書き
2. ✅ **Google Drive API** - 動画ファイルダウンロード
3. ⭐ **Service Usage API** - 使用状況確認（オプション）

### その他の設定

- ✅ サービスアカウント作成
- ✅ 認証キー（JSON）ダウンロード
- ✅ Sheets/Drive に権限付与
- ✅ Gemini APIキー取得

### 次のステップ

1. ✅ 上記のAPIをすべて有効化
2. ✅ サービスアカウントを作成＋JSONダウンロード
3. ✅ Sheets/Drive に権限付与
4. ✅ Gemini APIキー取得
5. ✅ 環境変数をRenderまたはGitHub Secretsに設定
6. 🚀 デプロイ＆テスト実行

詳細なデプロイ手順は `RENDER_DEPLOY.md` または `DEPLOY.md` を参照してください！
