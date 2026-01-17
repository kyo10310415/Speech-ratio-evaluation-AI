# 🚨 月次サマリー0問題 - 即座に実行する手順

## 現状
- ✅ マニュアル: 表示OK
- ❌ 月次サマリー: 0.0% / 0.0 / 0分 と表示される

## 🎯 解決方法（5分で実行）

### ステップ1: Render Shellにアクセス
1. https://dashboard.render.com/ を開く
2. `wannav-lesson-analyzer` をクリック
3. 右上の **Shell** ボタンをクリック

### ステップ2: 以下のコマンドをコピペして実行

```bash
cd /opt/render/project/src && bash quick-fix-monthly.sh
```

このスクリプトが自動で:
- ✅ ロックファイルを削除
- ✅ データの診断を実行
- ✅ 問題箇所を特定
- ✅ 月次ジョブの実行オプションを提示

### ステップ3: Google Sheetsでデータクリア

**重要**: 月次ジョブを実行する前に必ずこれを実行してください！

1. https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit を開く
2. **monthly_tutors** シートを選択
3. **2行目以降すべて** を選択して削除（ヘッダー行は残す）
4. （オプション）**monthly_lessons** シートも同様にクリア

### ステップ4: 月次ジョブを実行

Render Shellで:

```bash
cd /opt/render/project/src
rm -f temp/monthly-job.lock
nohup node src/jobs/monthly.js 2026-01-15 > /tmp/monthly-job.log 2>&1 &
```

**処理時間**: 約2-3時間（バックグラウンドで実行されます）

### ステップ5: 進捗を監視（オプション）

```bash
# リアルタイムでログを表示
tail -f /tmp/monthly-job.log

# 完了を確認
grep "COMPLETED" /tmp/monthly-job.log

# プロセスを確認
ps aux | grep "node src/jobs/monthly"
```

### ステップ6: 完了後に確認

**期待される完了メッセージ:**
```
========================================
MONTHLY JOB COMPLETED SUCCESSFULLY in 7234.56s
Processed 46 lessons (random 2 per tutor)
Parallel processing: 46 succeeded, 0 failed
========================================
```

**Google Sheetsで確認:**
https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit

`monthly_tutors` シート:
```
date_jst | tutor_name | avg_tutor_talk_ratio | avg_silence_15s_count | total_duration_min
2026-01  | あやこ先生  | 0.524                | 18.5                  | 112.3
```

**ダッシュボードで確認:**
https://speech-ratio-evaluation-ai.onrender.com

月次サマリーテーブル:
- 平均発話比率: **52.4%** ← 0%でない
- 平均沈黙回数: **18.5** ← 0でない
- 合計時間: **112分** ← 0分でない

---

## 📋 チェックリスト

- [ ] Render Shellにアクセス
- [ ] `bash quick-fix-monthly.sh` を実行
- [ ] Google Sheetsで `monthly_tutors` の2行目以降を削除
- [ ] 月次ジョブを実行（nohup コマンド）
- [ ] 2-3時間待つ（Shellは閉じてOK）
- [ ] 完了メッセージを確認
- [ ] Google Sheetsでデータを確認
- [ ] ダッシュボードで0でない値を確認

---

## ⚠️ 重要な注意

### やってはいけないこと
- ❌ Google Sheetsでデータをクリアせずに月次ジョブを実行 → データが重複する
- ❌ 月次ジョブ実行中にもう一度実行 → エラーになる（ロックファイルで保護）
- ❌ Shellを開いたまま2-3時間待つ → 不要（nohupでバックグラウンド実行）

### うまくいかない場合
1. ロックファイルを削除: `rm -f /opt/render/project/src/temp/monthly-job.lock`
2. プロセスを強制終了: `pkill -f "node src/jobs/monthly"`
3. もう一度ステップ3から実行

---

## 🔗 関連リンク

- **Render Dashboard**: https://dashboard.render.com/
- **Google Sheets**: https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit
- **ダッシュボード**: https://speech-ratio-evaluation-ai.onrender.com
- **GitHub**: https://github.com/kyo10310415/Speech-ratio-evaluation-AI

---

**作成日**: 2026-01-17  
**推定完了時間**: データクリア5分 + 処理2-3時間 = 合計2-3時間
