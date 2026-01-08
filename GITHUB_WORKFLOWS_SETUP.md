# GitHub Actions ワークフロー手動追加ガイド

## 問題

GitHub Appに`workflows`権限がないため、`.github/workflows/`ディレクトリのファイルをプッシュできません。

## 解決方法

### オプション1: GitHub Webインターフェースから追加（推奨）

1. **GitHub リポジトリにアクセス**
   - https://github.com/kyo10310415/Speech-ratio-evaluation-AI

2. **Actionsタブをクリック**

3. **"set up a workflow yourself"をクリック**

4. **daily.yml を作成**
   - ファイル名: `.github/workflows/daily.yml`
   - 内容: 以下をコピー

```yaml
name: Daily Lesson Analysis

on:
  schedule:
    # Run daily at 9:00 JST (00:00 UTC)
    - cron: '0 0 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  analyze:
    runs-on: ubuntu-latest
    timeout-minutes: 120 # 2 hours max

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install ffmpeg
        run: |
          sudo apt-get update
          sudo apt-get install -y ffmpeg

      - name: Run daily job
        env:
          GOOGLE_SHEETS_ID: ${{ secrets.GOOGLE_SHEETS_ID }}
          GOOGLE_SERVICE_ACCOUNT_EMAIL: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_EMAIL }}
          GOOGLE_PRIVATE_KEY: ${{ secrets.GOOGLE_PRIVATE_KEY }}
          GOOGLE_AI_API_KEY: ${{ secrets.GOOGLE_AI_API_KEY }}
          ASSEMBLYAI_API_KEY: ${{ secrets.ASSEMBLYAI_API_KEY }}
          TZ: Asia/Tokyo
        run: npm run daily

      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: daily-logs-${{ github.run_number }}
          path: logs/
          retention-days: 30
```

5. **weekly.yml を作成**
   - 同様の手順で新しいワークフローを作成
   - ファイル名: `.github/workflows/weekly.yml`
   - 内容: 以下をコピー

```yaml
name: Weekly Lesson Summary

on:
  schedule:
    # Run every Monday at 9:00 JST (00:00 UTC on Monday)
    - cron: '0 0 * * 1'
  workflow_dispatch: # Allow manual trigger

jobs:
  summarize:
    runs-on: ubuntu-latest
    timeout-minutes: 60 # 1 hour max

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run weekly job
        env:
          GOOGLE_SHEETS_ID: ${{ secrets.GOOGLE_SHEETS_ID }}
          GOOGLE_SERVICE_ACCOUNT_EMAIL: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_EMAIL }}
          GOOGLE_PRIVATE_KEY: ${{ secrets.GOOGLE_PRIVATE_KEY }}
          GOOGLE_AI_API_KEY: ${{ secrets.GOOGLE_AI_API_KEY }}
          TZ: Asia/Tokyo
        run: npm run weekly

      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: weekly-logs-${{ github.run_number }}
          path: logs/
          retention-days: 30
```

### オプション2: ローカルで.github/workflowsを削除してデプロイ

ワークフローファイルなしでもシステムは動作します（手動実行のみ）：

```bash
# ワークフローを削除（ローカルにはバックアップあり）
cd /home/user/webapp
rm -rf .github/workflows

# コミット＆プッシュ
git add .
git commit -m "Remove workflows (will add via GitHub UI)"
git push origin main
```

その後、オプション1の手順でGitHub UIから追加してください。

## 次のステップ

1. ✅ ワークフローファイルをGitHub UIから追加
2. ✅ GitHub Secretsを設定（Settings > Secrets and variables > Actions）
   - `GOOGLE_SHEETS_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_AI_API_KEY`
   - `ASSEMBLYAI_API_KEY` (オプション)
3. ✅ Actions タブから手動実行でテスト

## 現在の状況

- ✅ コードは正常にGitHubにプッシュされました
- ✅ すべての機能は実装済み
- ⚠️ ワークフローファイルのみ手動追加が必要

プロジェクトURL: https://github.com/kyo10310415/Speech-ratio-evaluation-AI
