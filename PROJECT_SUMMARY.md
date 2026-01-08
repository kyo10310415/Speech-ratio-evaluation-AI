# WannaV Lesson Analyzer - プロジェクトサマリー

## 完了した実装

### ✅ コア機能
1. **Google Sheets API連携**
   - 入力シート（シート1）からtutor情報とフォルダURL読み取り
   - 出力シート（daily_lessons, daily_tutors, weekly_tutors）への書き込み
   - 冪等性（drive_file_id重複チェック）

2. **Google Drive API連携**
   - フォルダIDの抽出
   - 動画ファイルの列挙（日付範囲フィルタ）
   - 動画ファイルのダウンロード

3. **音声処理**
   - ffmpegによる音声抽出
   - ラウドネス正規化（-16 LUFS）
   - ノイズ除去フィルタ

4. **文字起こし・話者分離**
   - OpenAI Whisper APIによる文字起こし
   - AssemblyAI APIによる話者分離（推奨）
   - フォールバック: 簡易話者分離

5. **KPI分析**
   - 発話比率（Tutor/Student）
   - 連続発話（モノローグ）検出
   - 沈黙検出
   - 割り込み（被せ）検出
   - 生徒参加度

6. **感情シグナル分析**
   - 困惑シグナルTOP3（時刻+根拠）
   - ストレスシグナルTOP3
   - ポジティブシグナルTOP3
   - GPT-4による文脈理解

7. **レポート生成**
   - 改善アドバイス（200〜500文字）
   - 推奨アクションTOP3
   - 週次スコア計算（0〜100）

8. **スケジューラ**
   - 日次ジョブ（前日分、毎日9:00 JST）
   - 週次ジョブ（前週月〜日、毎週月曜9:00 JST）

9. **デプロイ設定**
   - GitHub Actions（cron定期実行）
   - Render設定（オプション）

## ディレクトリ構造

```
wannav-lesson-analyzer/
├── src/
│   ├── config/
│   │   └── env.js                    # 環境変数管理
│   ├── services/
│   │   ├── sheetsService.js          # Google Sheets API
│   │   ├── driveService.js           # Google Drive API
│   │   ├── audioService.js           # 音声抽出・前処理
│   │   ├── transcriptionService.js   # 文字起こし・話者分離
│   │   └── lessonProcessor.js        # レッスン処理オーケストレーション
│   ├── analyzers/
│   │   ├── kpiAnalyzer.js            # KPI計算
│   │   └── emotionAnalyzer.js        # 感情分析・レポート生成
│   ├── jobs/
│   │   ├── daily.js                  # 日次ジョブ
│   │   └── weekly.js                 # 週次ジョブ
│   ├── utils/
│   │   ├── logger.js                 # ログ管理
│   │   ├── dateUtils.js              # 日付処理（JST対応）
│   │   └── sheetFormatters.js        # シート出力フォーマット
│   ├── index.js                      # エントリーポイント
│   └── validate-env.js               # 環境変数検証
├── .github/
│   └── workflows/
│       ├── daily.yml                 # 日次ワークフロー
│       └── weekly.yml                # 週次ワークフロー
├── logs/                             # ログファイル（自動生成）
├── temp/                             # 一時ファイル（自動生成）
├── .gitignore
├── .env.example
├── package.json
├── render.yaml                       # Render設定
├── README.md                         # 使用方法
└── DEPLOY.md                         # デプロイガイド
```

## 技術スタック

### Backend
- **Node.js 18+**: JavaScript runtime
- **ES Modules**: モダンなモジュールシステム

### API & Services
- **Google APIs**: Sheets, Drive
- **OpenAI API**: Whisper（文字起こし）、GPT-4o-mini（分析）
- **AssemblyAI API**: Speaker Diarization（話者分離）

### Audio Processing
- **ffmpeg**: 音声抽出、正規化、フィルタリング
- **fluent-ffmpeg**: ffmpeg Node.jsラッパー

### Utilities
- **winston**: ロギング
- **date-fns**: 日付処理
- **date-fns-tz**: タイムゾーン対応（JST）
- **axios**: HTTP通信

### Deployment
- **GitHub Actions**: CI/CD、スケジューラ
- **Render**: バックグラウンドワーカー（オプション）

## データフロー

```
1. 入力（Google Sheets シート1）
   ↓
2. フォルダURL → Drive API → 動画ファイルリスト
   ↓
3. 動画ダウンロード → 音声抽出 → 正規化
   ↓
4. Whisper API → 文字起こし
   ↓
5. AssemblyAI → 話者分離（Tutor/Student）
   ↓
6. KPI計算
   - 発話比率
   - モノローグ
   - 沈黙
   - 割り込み
   ↓
7. GPT-4分析
   - 感情シグナル（困惑/ストレス/ポジティブ）
   - 改善アドバイス
   - 推奨アクション
   ↓
8. 出力（Google Sheets）
   - daily_lessons: レッスン詳細
   - daily_tutors: 日次集計
   - weekly_tutors: 週次スコア
```

## 主要機能の実装詳細

### 冪等性保証
- `daily_lessons` シートの `drive_file_id` をキーとして使用
- 処理前に既存IDをチェック
- 重複は自動スキップ
- ERROR行は再処理可能（将来拡張）

### 話者識別
- **優先**: AssemblyAI API（高精度）
- **フォールバック**: 簡易ルールベース（発話パターン）
- 2人固定（Tutor/Student）
- SPEAKER_A → Tutor, SPEAKER_B → Student

### 感情シグナル
- テキスト + 音声特徴から区間抽出
- TOP3区間を時刻付きで出力
- 推定割合（ratio_est）も算出
- 根拠テキストを必ず併記

### 週次スコア計算
- 基準点: 100点
- 減点方式:
  - 発話比率高: -15〜-30点
  - 長時間モノローグ: -10〜-20点
  - 割り込み頻繁: -8〜-15点
  - 生徒発話少: -10〜-20点
  - 困惑/ストレス高: -8〜-15点
- 最終スコア: 0〜100点

## セキュリティ考慮事項

### 実装済み
- `.gitignore` による認証情報の除外
- GitHub Secrets による環境変数暗号化
- サービスアカウント最小権限（Sheets編集、Drive閲覧のみ）
- 一時ファイルの自動削除

### 注意点
- 文字起こし全文はログに残さない（プライバシー保護）
- APIキーは定期的にローテーション推奨
- Private Keyは絶対にコミットしない

## コスト見積もり（参考）

### レッスン1本（60分）あたり
- OpenAI Whisper: $0.36（60分 × $0.006/分）
- OpenAI GPT-4o-mini: $0.10〜$0.20（分析タスク）
- AssemblyAI: $0.90（60分 × $0.015/分、推奨）
- **合計**: 約$1.40〜$1.50/レッスン

### 月間コスト（例: 20レッスン/日 × 30日 = 600レッスン/月）
- API費用: $840〜$900/月
- GitHub Actions: 無料枠内（2,000分/月）
- Render: $7/月（オプション）
- **合計**: 約$850〜$910/月

## 今後の拡張予定

### 短期（v1.1）
- [ ] エラーハンドリング強化（リトライロジック）
- [ ] 処理進捗通知（Slack/Email）
- [ ] バッチ処理の並列化（複数動画同時処理）

### 中期（v1.2）
- [ ] 表情解析（顔出しレッスン対応）
- [ ] カスタムKPI設定（YAML設定ファイル）
- [ ] 多言語対応（英語、中国語等）

### 長期（v2.0）
- [ ] リアルタイム分析（ライブレッスン対応）
- [ ] Webダッシュボード（可視化UI）
- [ ] 講師向けフィードバックシステム
- [ ] 機械学習モデルの統合（カスタム感情分析）

## 既知の制限事項

1. **同一音声トラック前提**
   - 別トラックの場合は事前にミックスダウンが必要

2. **話者数2人固定**
   - 3人以上の会話には未対応

3. **音声品質依存**
   - 低品質音声では精度低下
   - ノイズが多い場合は前処理強化が必要

4. **処理時間**
   - 60分動画の処理に10〜15分程度かかる
   - GitHub Actionsのタイムアウトに注意（現在120分設定）

5. **言語**
   - 主に日本語対応
   - 英語も動作するが、GPTプロンプトは日本語前提

## 受け入れ基準チェックリスト

- [x] シート1から folder_url と tutor_name を取得できる
- [x] Driveから対象期間（前日/前週）の動画のみ抽出できる
- [x] 動画1本につき daily_lessons へ1行追記され、重複しない
- [x] Tutor別の daily_tutors が作成される
- [x] 月曜に weekly_tutors が作成される（前週 月〜日）
- [x] 発話比率・最長連続発話が数値で出る
- [x] 困惑/ストレスは「TOP3区間（時刻＋根拠）」が出る
- [x] GitHub Actions で定期実行される
- [x] エラー時は ERROR 行が記録される

## 開発者向けメモ

### ローカル開発
```bash
# 環境変数検証
npm run validate

# 日次ジョブ実行
npm run daily

# 週次ジョブ実行
npm run weekly
```

### ログ確認
```bash
tail -f logs/combined.log
tail -f logs/error.log
```

### デバッグモード
`.env` ファイルで `LOG_LEVEL=debug` に設定

### テスト実行
```bash
npm test  # 将来実装予定
```

## ライセンス

MIT License

## 作成日

2026-01-08

## バージョン

v1.0.0 - 初版リリース
