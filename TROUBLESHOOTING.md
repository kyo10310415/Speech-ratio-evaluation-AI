# トラブルシューティングガイド

## 月次サマリーが0になる問題

### 原因
Google Sheets の `monthly_tutors` シートに古いデータ形式が残っている可能性があります。

### 解決方法

#### 方法1: 月次ジョブを再実行
新しい月のデータで月次ジョブを再実行します：

```bash
# Render Shell で実行
cd /opt/render/project/src

# ロックファイルを削除
rm -f temp/monthly-job.lock

# 月次ジョブを実行（新しい月を指定）
node src/jobs/monthly.js 2026-02-15

# または、既存の月をクリアして再実行
# Google Sheets で monthly_tutors シートのデータ行を手動削除してから
node src/jobs/monthly.js 2026-01-15
```

#### 方法2: Google Sheets で手動クリア
1. Google Sheets を開く: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID
2. `monthly_tutors` シートを選択
3. 2行目以降のデータをすべて削除（ヘッダー行は残す）
4. 月次ジョブを再実行

#### 方法3: シート自体を削除
1. Google Sheets を開く
2. `monthly_tutors` シートのタブを右クリック → 削除
3. 月次ジョブを実行すると新しいシートが自動作成されます

### 確認方法

#### ダッシュボードで確認
https://speech-ratio-evaluation-ai.onrender.com にアクセスし、月次サマリーテーブルを確認：

- ✅ 平均発話比率: 52.4% のように表示される
- ✅ 平均沈黙回数: 18.5 のように表示される
- ✅ 合計時間: 112.3 のように表示される

#### Google Sheets で直接確認
`monthly_tutors` シートを開いて、以下のカラムを確認：

```
date_jst | tutor_name | lessons_count | avg_tutor_talk_ratio | avg_silence_15s_count | total_duration_min
2026-01  | あやこ先生  | 2             | 0.524                | 18.5                  | 112.3
```

- `avg_tutor_talk_ratio` は 0.0 〜 1.0 の範囲（例: 0.524 = 52.4%）
- `avg_silence_15s_count` は実数（例: 18.5）
- `total_duration_min` は実数（例: 112.3 分）

---

## ユーザーマニュアルが404エラーになる問題

### 原因
サーバーで `/manual.html` のルートが設定されていませんでした。

### 解決済み
v3.0.1 で修正されました。Render で自動デプロイされます。

### 確認方法
https://speech-ratio-evaluation-ai.onrender.com/manual.html にアクセスして、マニュアルが表示されることを確認。

---

## よくある問題

### Q1: ダッシュボードに「データがありません」と表示される

**原因**: 月次ジョブが一度も実行されていない

**解決策**:
```bash
# Render Shell で月次ジョブを手動実行
cd /opt/render/project/src
node src/jobs/monthly.js 2026-01-15
```

### Q2: レッスン詳細が表示されない

**原因**: `monthly_lessons` シートにデータがない、または status が ERROR になっている

**解決策**:
1. Google Sheets で `monthly_lessons` シートを確認
2. `status` カラムが `OK` になっているか確認
3. 問題があれば月次ジョブを再実行

### Q3: デプロイ後にダッシュボードが更新されない

**原因**: Render のビルドキャッシュまたはブラウザキャッシュ

**解決策**:
1. Render Dashboard で Manual Deploy → Clear build cache & deploy
2. ブラウザで Ctrl+Shift+R（強制リロード）

### Q4: 月次ジョブが実行されない

**原因**: ロックファイルが残っている

**解決策**:
```bash
# Render Shell
cd /opt/render/project/src
rm -f temp/monthly-job.lock
```

---

## ログの確認方法

### Render Dashboard でログ確認
1. https://dashboard.render.com/ にログイン
2. `wannav-lesson-analyzer` サービスを選択
3. Logs タブを開く

### 月次ジョブのログ
```bash
# Render Shell
tail -f /tmp/monthly-job.log

# 完了メッセージを確認
grep "COMPLETED" /tmp/monthly-job.log
```

### エラー確認
```bash
# エラー行のみ表示
npm run monitor:errors

# または手動で確認
node src/monitor-errors.js
```

---

## サポート情報

### GitHub リポジトリ
https://github.com/kyo10310415/Speech-ratio-evaluation-AI

### 関連ドキュメント
- README.md: プロジェクト概要
- USER_MANUAL.md: ユーザーマニュアル（詳細版）
- MONTHLY_EVALUATION_GUIDE.md: 月次評価システムガイド
- RENDER_DEPLOY_GUIDE.md: Render デプロイガイド

### バージョン情報
- 現在のバージョン: v3.0.1
- 最終更新: 2026-01-17
