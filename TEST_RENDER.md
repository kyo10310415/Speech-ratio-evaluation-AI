# Render環境でのテスト方法

## 方法A: Render Shell（推奨）

### 1. Render Dashboard を開く
https://dashboard.render.com/

### 2. サービスを選択
`wannav-lesson-analyzer` をクリック

### 3. Shell を開く
- 右上の「Shell」ボタンをクリック
- またはURLから直接: https://dashboard.render.com/web/srv-xxxxx/shell

### 4. テストコマンドを実行

#### 昨日のデータでテスト（日付自動計算）
```bash
node src/jobs/daily-test.js
```

#### 特定日付でテスト
```bash
node src/jobs/daily-test.js 2026-01-13
```

#### 週次ジョブのテスト
```bash
node src/jobs/weekly.js
```

### 5. ログ確認
リアルタイムでログが表示されます：
```
=== DAILY JOB TEST (FIRST ROW ONLY) ===
Test date: 2026-01-13
Processing tutor: きょうへい先生
...
DAILY JOB TEST COMPLETED SUCCESSFULLY
```

---

## 方法B: GitHub Actions 手動実行

### 1. GitHub リポジトリを開く
https://github.com/kyo10310415/Speech-ratio-evaluation-AI

### 2. Actions タブを開く
- 上部の「Actions」タブをクリック

### 3. ワークフローを選択
- 左メニューから「Daily Lesson Analysis」を選択

### 4. 手動実行
- 「Run workflow」をクリック
- ブランチ: `main`
- 「Run workflow」を確認

### 5. 実行結果確認
- ワークフロー実行をクリック
- 各ステップのログを確認

**注意**: GitHub Actionsは環境変数を別途設定する必要があります（Settings > Secrets）

---

## 方法C: ローカル環境でテスト（開発用）

### 1. 環境変数を設定
`.env` ファイルを作成：
```bash
GOOGLE_SHEETS_ID=1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_AI_API_KEY=your-api-key
TZ=Asia/Tokyo
MAX_CONCURRENCY=5
```

### 2. テストコマンドを実行
```bash
# 昨日のデータでテスト
npm run daily:test

# 特定日付でテスト
npm run daily:test 2026-01-13

# 週次ジョブのテスト
npm run weekly
```

### 3. デバッグコマンド
```bash
# カバレッジ確認
npm run debug:transcription

# エラーモニタリング
npm run monitor:errors
```

---

## 推奨テストフロー

### 初回デプロイ後
1. **Render Shell でテスト** → 本番環境と同じ条件
2. **スプレッドシート確認** → データが正しく書き込まれているか
3. **ダッシュボード確認** → データが表示されているか
4. **エラーモニタリング** → エラー率を確認

### 日常的なテスト
- **明日の自動実行を待つ** → 最も確実
- **問題があればRender Shellで再実行** → トラブルシューティング

---

## テスト時の注意事項

### 1. テストモード（FIRST ROW ONLY）
- `daily-test.js` は最初の講師のみ処理
- データベースへの影響を最小化
- 処理時間: 約10-15分

### 2. 本番モード（全講師）
- `daily.js` は全講師を処理
- 35本 × 12分 = 約420分（5並列で84分）
- スプレッドシートに全データ追加

### 3. 冪等性
- 同じ動画は2回処理されない
- `drive_file_id` でチェック
- エラー行は再処理可能（`npm run clear:errors`）

---

## よくある質問

### Q: テストで本番データが壊れない？
A: 大丈夫です。
- `daily-test.js` は新しい行を追加するのみ
- 既存データは変更しない
- 冪等性チェックで重複防止

### Q: テストデータを削除したい
A: スプレッドシートで手動削除
```
1. daily_lessons シートを開く
2. テストデータの行を選択
3. 右クリック → 行を削除
```

### Q: エラーが出たら？
A: ログを確認
```bash
# Render Logs
Render Dashboard → Logs タブ

# エラーモニタリング
npm run monitor:errors
```

---

## トラブルシューティング

### ケース1: Render Shell が開かない
**原因**: サービスが停止している
**解決**: Deploy タブで再デプロイ

### ケース2: テストコマンドが見つからない
**原因**: ビルドが完了していない
**解決**: Deploy タブでビルド完了を確認

### ケース3: 環境変数エラー
**原因**: 環境変数が未設定
**解決**: Environment タブで設定を確認

---

## まとめ

| 方法 | メリット | デメリット | 推奨度 |
|------|---------|-----------|--------|
| Render Shell | 本番環境と同じ | ブラウザが必要 | ⭐⭐⭐⭐⭐ |
| GitHub Actions | 自動化可能 | 環境変数設定が必要 | ⭐⭐⭐ |
| ローカル環境 | デバッグしやすい | 本番と環境が異なる | ⭐⭐ |

**推奨**: Render Shell で本番環境をテスト 🚀
