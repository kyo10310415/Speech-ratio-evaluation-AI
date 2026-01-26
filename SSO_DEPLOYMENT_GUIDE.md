# 🔐 SSO認証統合デプロイガイド

## ✅ 完了した作業

### 1. SSO認証ミドルウェアの追加
- **ファイル**: `src/middleware/sso-auth.js`
- **コミット**: 239db0a から取得
- **機能**: JWT トークン検証、Cookie管理、認証リダイレクト

### 2. 依存関係の追加
- **パッケージ**: `jsonwebtoken@^9.0.3`
- **インストール完了**: ✅
- **package.json更新**: ✅

### 3. server.jsの統合
- **SSO認証ミドルウェアをインポート**: ✅
- **すべてのルートに適用**: ✅
  ```javascript
  app.use('*', ssoAuthMiddleware);
  ```

### 4. 環境変数の追加
- **.env.example更新**: ✅
- **新規変数**:
  - `JWT_SECRET` - WannaV Mainと共有するシークレットキー
  - `DASHBOARD_URL` - リダイレクト先URL

---

## 🚀 Renderへのデプロイ手順

### ステップ1: Render環境変数を設定

**https://dashboard.render.com/** にアクセスして以下を設定：

1. **wannav-lesson-analyzer** を選択
2. **Environment** タブを開く
3. **以下の環境変数を追加**:

```env
JWT_SECRET=<WannaV Mainと同じシークレットキー>
DASHBOARD_URL=https://wannav-main.onrender.com
```

#### 重要ポイント:
- ⚠️ **JWT_SECRET** は WannaV Main Dashboard と **完全に同じ値** を使用すること
- ⚠️ これがないとトークン検証が失敗します

---

### ステップ2: デプロイを実行

1. **Manual Deploy** → **Deploy latest commit** をクリック
2. デプロイ完了を待つ（3-5分）
3. ログで以下を確認：
   ```
   ✅ SSO 認証成功: user@example.com (admin)
   ```

---

## 🔍 デプロイ後の確認

### 1. ログの確認

**Renderダッシュボード** → **Logs** で以下のログを確認：

#### ✅ 成功パターン:
```
❌ SSO トークンなし → ダッシュボードにリダイレクト
✅ SSO 認証成功: k.sakamoto@oneloopinc.net (admin)
✅ SSO 認証成功: k.sakamoto@oneloopinc.net (admin)
```

#### ❌ エラーパターン:
```
❌ SSO トークン検証エラー: jwt malformed
❌ SSO トークン検証エラー: invalid signature
```

**解決策**: `JWT_SECRET` が WannaV Main と同じか確認

---

### 2. アクセステスト

#### テスト1: 直接アクセス（トークンなし）
```
URL: https://speech-ratio-evaluation-ai.onrender.com
期待結果: WannaV Main Dashboard にリダイレクト
```

#### テスト2: WannaV Main経由でアクセス
```
1. WannaV Main Dashboard にログイン
2. このシステムへのリンクをクリック
期待結果: 認証成功してダッシュボード表示
```

---

## 🔒 SSO認証の仕組み

### 認証フロー
```
1. ユーザーがアクセス
   ↓
2. ssoAuthMiddleware が実行
   ↓
3. Cookie または URLパラメータからトークン取得
   ↓
4. トークンがない？
   YES → WannaV Main にリダイレクト
   NO  → JWT検証へ
   ↓
5. JWT検証（JWT_SECRET使用）
   ↓
6. 検証成功？
   YES → ユーザー情報を保存してページ表示
   NO  → WannaV Main にリダイレクト
```

### トークンの内容
```json
{
  "type": "sso",
  "userId": 123,
  "username": "k.sakamoto@oneloopinc.net",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## 📝 保護されるエンドポイント

すべてのルートがSSO認証で保護されています：

- ✅ `/` - ダッシュボードトップ
- ✅ `/sales` - セールスチームダッシュボード
- ✅ `/api/tutors` - 講師一覧API
- ✅ `/api/monthly-summary` - 月次サマリーAPI
- ✅ `/api/sales-summary` - セールスサマリーAPI
- ✅ `/api/lessons` - レッスン一覧API
- ✅ `/api/lessons/:fileId` - レッスン詳細API
- ✅ `/static/*` - 静的ファイル
- ✅ `/manual.html` - マニュアル

**認証なしでアクセスできるエンドポイント**: なし（すべて保護）

---

## 🐛 トラブルシューティング

### 問題1: 無限リダイレクト
**症状**: WannaV Main とこのシステムの間でループ

**原因**:
- JWT_SECRET が異なる
- トークンの type が 'sso' ではない

**解決策**:
```bash
# Render環境変数を確認
JWT_SECRET=<WannaV Mainと完全に同じ値>
```

---

### 問題2: トークン検証エラー
**症状**: ログに `❌ SSO トークン検証エラー: invalid signature`

**原因**: JWT_SECRET が WannaV Main と異なる

**解決策**:
1. WannaV Main の JWT_SECRET を確認
2. Render環境変数を更新
3. サービスを再起動

---

### 問題3: トークンが保存されない
**症状**: ページをリロードするたびに認証が求められる

**原因**: Cookie設定の問題

**解決策**:
- HTTPS通信を確認（Renderは自動的にHTTPS）
- ブラウザのCookie設定を確認

---

## 📊 今回の変更まとめ

### コミット履歴
```
56a37b8 Feat: Add SSO authentication to current codebase
fb394b1 Fix: Filter ERROR status in API and add person_name to UI
3e39e3b Fix: Add person_name column, improve trim() safety, and enhance error handling
```

### 変更ファイル
```
新規:
  src/middleware/sso-auth.js    ← SSO認証ミドルウェア

変更:
  src/dashboard/server.js       ← SSO統合
  package.json                  ← jsonwebtoken追加
  .env.example                  ← JWT_SECRET, DASHBOARD_URL追加
```

---

## ✅ デプロイチェックリスト

- [ ] Render環境変数に `JWT_SECRET` を追加（WannaV Mainと同じ値）
- [ ] Render環境変数に `DASHBOARD_URL` を追加
- [ ] Manual Deploy → Deploy latest commit 実行
- [ ] ログで `✅ SSO 認証成功` を確認
- [ ] WannaV Main からアクセスして動作確認
- [ ] 直接アクセスでリダイレクト確認

---

## 🎯 次のステップ

1. **Render環境変数を設定**
2. **デプロイを実行**
3. **動作確認**
4. **問題があればログを確認**

---

**準備完了！Renderでデプロイしてください** 🚀
