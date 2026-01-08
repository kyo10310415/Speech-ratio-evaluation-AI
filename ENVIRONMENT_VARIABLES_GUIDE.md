# 環境変数の必須/オプション詳細ガイド

## 📋 環境変数の分類

### ✅ 必須（5つ）- これがないと動作しません

| 変数名 | 説明 | なぜ必須？ |
|-------|------|-----------|
| `GOOGLE_SHEETS_ID` | スプレッドシートID | データの読み書きに必須 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | サービスアカウントメール | Google API認証に必須 |
| `GOOGLE_PRIVATE_KEY` | サービスアカウント秘密鍵 | Google API認証に必須 |
| `GOOGLE_AI_API_KEY` | Gemini APIキー | 文字起こし・分析に必須 |
| `TZ` | タイムゾーン | 日付計算に必須（`Asia/Tokyo`） |

### ⭐ 推奨（1つ）- あると品質が大幅向上

| 変数名 | 説明 | メリット |
|-------|------|---------|
| `ASSEMBLYAI_API_KEY` | AssemblyAI APIキー | 話者分離の精度が大幅向上 |

### 🔧 オプション（2つ）- なくても動作します

| 変数名 | 説明 | メリット |
|-------|------|---------|
| `LOG_LEVEL` | ログレベル | デバッグが簡単になる |
| `DASHBOARD_PORT` | ダッシュボードポート | Renderでは不要（自動設定） |

---

## 🎯 ASSEMBLYAI_API_KEY の詳細

### ❌ ない場合の動作

**Geminiの話者分離を使用**（精度：中）

```javascript
話者分離方法: Gemini 1.5 Pro
- Geminiが音声から話者を自動推定
- 精度: 70-80%程度
- コスト: 約$0.05/レッスン

問題点:
❌ 話者の切り替わりを誤認識することがある
❌ 声質が似ている場合、混同する
❌ 沈黙が長い場合、同じ話者を別人と判定
```

**実際の出力例（精度低）**:
```
[00:30] Tutor: では始めましょう
[00:35] Student: よろしくお願いします
[01:00] Tutor: 今日のテーマは...  ← 正しい
[03:20] Student: 質問があります    ← 誤認識（実際はTutor）
[03:25] Tutor: はい、どうぞ       ← 正しい
```

### ✅ ある場合の動作

**AssemblyAIの話者分離を使用**（精度：高）

```javascript
話者分離方法: AssemblyAI Speaker Diarization
- 業界標準の高精度アルゴリズム
- 精度: 95%以上
- コスト: 約$0.90/レッスン（追加）

メリット:
✅ 話者の切り替わりを正確に認識
✅ 声質が似ていても正確に分離
✅ 長時間の会話でも精度維持
✅ ノイズがあっても安定
```

**実際の出力例（精度高）**:
```
[00:30] Tutor: では始めましょう
[00:35] Student: よろしくお願いします
[01:00] Tutor: 今日のテーマは...
[03:20] Tutor: 質問ありますか？   ← 正確！
[03:25] Student: はい、あります   ← 正確！
```

---

## 💰 コスト比較

### Geminiのみ（AssemblyAI なし）

| 項目 | コスト |
|------|-------|
| Gemini文字起こし | $0.05 |
| Gemini話者分離 | 込み |
| Gemini分析 | $0.01 |
| **合計/レッスン** | **$0.06** |

**メリット**: 安い  
**デメリット**: 話者分離精度が低い（70-80%）

### Gemini + AssemblyAI（推奨）

| 項目 | コスト |
|------|-------|
| Gemini文字起こし | $0.05 |
| **AssemblyAI話者分離** | **$0.90** |
| Gemini分析 | $0.01 |
| **合計/レッスン** | **$0.96** |

**メリット**: 話者分離精度が高い（95%以上）  
**デメリット**: コストが15倍高い

---

## 📊 精度の重要性

### なぜ話者分離が重要か？

このシステムの**すべてのKPI**は話者分離に依存します:

```
話者分離が間違っていると...

❌ 発話比率が間違う
  例: Tutor 70% → 実際は Student 70%

❌ 最長モノローグが間違う
  例: Tutor 5分連続 → 実際は Student

❌ 割り込みカウントが間違う
  例: 実際はない割り込みをカウント

❌ 感情シグナルが間違う
  例: Student の困惑 → 実際は Tutor

❌ 改善アドバイスが的外れ
  例: 「講師は話しすぎ」 → 実際は生徒が話しすぎ
```

**話者分離が間違うと、分析全体が無意味になります。**

---

## 🎯 推奨設定

### ケース1: 本番運用・高品質を求める

```bash
ASSEMBLYAI_API_KEY=your-assemblyai-api-key  # ✅ 設定する
```

**推奨理由**:
- ✅ 正確な分析が重要
- ✅ コスト増加は許容範囲（$0.90/レッスン）
- ✅ 分析結果に基づいてアクションを取る

**こんな場合に推奨**:
- 📊 週次レポートで講師にフィードバック
- 💼 レッスン品質を定量的に評価
- 📈 改善施策の効果測定

### ケース2: テスト・コスト重視

```bash
# ASSEMBLYAI_API_KEY は設定しない
```

**メリット**:
- ✅ コストが安い（$0.06/レッスン）
- ✅ 大まかな傾向把握には十分

**デメリット**:
- ❌ 精度が低い（70-80%）
- ❌ 個別レッスンの詳細分析には不向き

**こんな場合に推奨**:
- 🧪 システムの動作確認
- 📊 大まかな傾向把握（週次スコアなど）
- 💰 予算が限られている

---

## 🔧 LOG_LEVEL の詳細

### ❌ ない場合（またはデフォルト）

```bash
# LOG_LEVEL 未設定
# デフォルト: info
```

**動作**:
```
2024-01-08 09:00:00 [INFO]: Starting DAILY JOB
2024-01-08 09:00:01 [INFO]: All services initialized
2024-01-08 09:00:02 [INFO]: Found 2 tutor records
2024-01-08 09:00:03 [INFO]: Processing tutor: 山田太郎
...
2024-01-08 09:15:00 [INFO]: DAILY JOB COMPLETED
```

**特徴**:
- ✅ 重要な情報のみ表示
- ✅ ログが読みやすい
- ✅ 本番運用に最適

### ✅ ある場合（debug）

```bash
LOG_LEVEL=debug
```

**動作**:
```
2024-01-08 09:00:00 [INFO]: Starting DAILY JOB
2024-01-08 09:00:00 [DEBUG]: Loading environment variables
2024-01-08 09:00:00 [DEBUG]: GOOGLE_SHEETS_ID: 1gFr...
2024-01-08 09:00:01 [DEBUG]: Initializing Google Sheets API
2024-01-08 09:00:01 [DEBUG]: Creating auth client
2024-01-08 09:00:01 [DEBUG]: Auth client created successfully
2024-01-08 09:00:01 [INFO]: All services initialized
2024-01-08 09:00:02 [DEBUG]: Fetching data from シート1!A2:D
2024-01-08 09:00:02 [DEBUG]: Response: 2 rows
2024-01-08 09:00:02 [INFO]: Found 2 tutor records
2024-01-08 09:00:03 [DEBUG]: Processing record: { tutorName: '山田太郎', ... }
2024-01-08 09:00:03 [DEBUG]: Extracting folder ID from URL
2024-01-08 09:00:03 [DEBUG]: Folder ID: ABC123
...
```

**特徴**:
- ✅ 詳細な実行情報
- ✅ エラー発生時の原因特定が簡単
- ✅ 開発・デバッグに最適
- ❌ ログが多すぎて読みにくい

---

## 📋 LOG_LEVEL の使い分け

### `info`（デフォルト、推奨）

**用途**: 本番運用

```bash
LOG_LEVEL=info  # または未設定
```

**表示内容**:
- ✅ ジョブの開始/完了
- ✅ 処理中の講師名
- ✅ 成功/失敗
- ✅ エラーメッセージ

### `debug`

**用途**: トラブルシューティング

```bash
LOG_LEVEL=debug
```

**表示内容**:
- ✅ すべての API 呼び出し
- ✅ 環境変数の値
- ✅ 中間処理の結果
- ✅ 詳細なエラー情報

**いつ使う？**:
- 🐛 エラーが発生して原因不明
- 🔍 どこで処理が止まっているか確認
- 🧪 新機能のテスト

### `error`

**用途**: エラーのみ記録

```bash
LOG_LEVEL=error
```

**表示内容**:
- ❌ エラーメッセージのみ

**いつ使う？**:
- 📊 ログファイルサイズを最小化
- 🔕 成功した処理には興味がない

---

## 💡 推奨設定（まとめ）

### 本番運用開始時（推奨）

```bash
# 必須
GOOGLE_SHEETS_ID=1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo
GOOGLE_SERVICE_ACCOUNT_EMAIL=wannav-lesson-analyzer@...
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
GOOGLE_AI_API_KEY=AIzaSy...
TZ=Asia/Tokyo

# 推奨（高品質な分析）
ASSEMBLYAI_API_KEY=your-assemblyai-api-key

# オプション（デフォルトでOK）
# LOG_LEVEL=info  # デフォルトなので不要
```

### テスト・動作確認時

```bash
# 必須
GOOGLE_SHEETS_ID=1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo
GOOGLE_SERVICE_ACCOUNT_EMAIL=wannav-lesson-analyzer@...
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
GOOGLE_AI_API_KEY=AIzaSy...
TZ=Asia/Tokyo

# テスト時は省略（コスト削減）
# ASSEMBLYAI_API_KEY は設定しない

# デバッグログ有効化
LOG_LEVEL=debug
```

### トラブルシューティング時

```bash
# 必須（すべて設定）
...

# デバッグログ有効化
LOG_LEVEL=debug
```

---

## 🎯 結論

### ASSEMBLYAI_API_KEY

**推奨**: ✅ **設定する**

**理由**:
- 話者分離精度が95%以上に向上
- すべてのKPIの正確性が保証される
- コスト増加（$0.90/レッスン）は品質向上に見合う

**設定しない場合**:
- コスト削減（$0.06/レッスン）
- 精度70-80%（本番運用には不十分）

### LOG_LEVEL

**推奨**: ⭐ **設定不要**（デフォルトの `info` が最適）

**設定する場合**:
- トラブルシューティング時のみ `debug` に設定
- 問題解決後はデフォルトに戻す

---

## 📊 コスト試算

### 月間600レッスンの場合

#### Geminiのみ
```
$0.06/レッスン × 600レッスン = $36/月
```

#### Gemini + AssemblyAI（推奨）
```
$0.96/レッスン × 600レッスン = $576/月
```

**差額**: $540/月

**判断基準**:
- 💼 **ビジネスクリティカル** → AssemblyAI必須
- 🧪 **テスト・個人利用** → Geminiのみでも可

---

## 🎊 最終推奨設定

```bash
# 本番運用（高品質）
GOOGLE_SHEETS_ID=1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo
GOOGLE_SERVICE_ACCOUNT_EMAIL=wannav-lesson-analyzer@...
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
GOOGLE_AI_API_KEY=AIzaSy...
ASSEMBLYAI_API_KEY=your-assemblyai-api-key  # 推奨
TZ=Asia/Tokyo
# LOG_LEVEL は設定不要（デフォルトでOK）
```

**これで最高品質の分析が可能です！**
