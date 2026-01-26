# 🔐 Google Drive フォルダ共有設定ガイド

## 問題
Google Drive API がフォルダ内のアイテムを取得できない（アイテム数: 0）

## 原因
サービスアカウントにフォルダの閲覧権限が付与されていない

---

## ✅ 解決方法

### ステップ1: サービスアカウントのメールアドレスを確認

Render Dashboard で環境変数を確認：

```
https://dashboard.render.com/ → wannav-lesson-analyzer → Environment
```

**確認する環境変数**:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL
```

例: `wannav-analyzer@xxxxx.iam.gserviceaccount.com`

---

### ステップ2: Google Drive フォルダに共有

各セールスフォルダ（4つすべて）に対して：

1. **Google Drive でフォルダを開く**:
   ```
   https://drive.google.com/drive/folders/1yCCfJV7aLBpT8gxr8PMkg9in9p_N4cDd
   https://drive.google.com/drive/folders/1sZjR8N49TWUw0EiKkuQqNhN4xMObjKL7
   https://drive.google.com/drive/folders/1yE9NqRw1R0SkeWInEE1g-5IMVbfRaHUk
   https://drive.google.com/drive/folders/1FJJSLKFEzE714VHLqO0ZIVutVLKJp2JO
   ```

2. **フォルダを右クリック → 「共有」をクリック**

3. **サービスアカウントのメールアドレスを追加**:
   - メールアドレス欄に貼り付け: `wannav-analyzer@xxxxx.iam.gserviceaccount.com`
   - 権限: **閲覧者（Viewer）** または **編集者（Editor）**
   - 「送信」をクリック

4. **子フォルダにも自動適用されるか確認**:
   - 「子アイテムに適用」にチェックが入っているか確認

---

### ステップ3: 共有確認コマンド

Render Shell で確認：

```bash
cd /opt/render/project/src

node -e "
import { driveService } from './src/services/driveService.js';
import { sheetsService } from './src/services/sheetsService.js';

async function checkAccess() {
  try {
    await sheetsService.initialize();
    await driveService.initialize();
    
    const data = await sheetsService.getSheetData('セールスフォルダ');
    
    console.log('========================================');
    console.log('フォルダアクセス確認');
    console.log('========================================\n');
    
    for (let i = 1; i < data.length; i++) {
      const folderName = data[i][0];
      const folderUrl = data[i][1];
      
      if (!folderUrl) continue;
      
      try {
        const folderId = driveService.extractFolderId(folderUrl);
        
        const response = await driveService.drive.files.list({
          q: \`'\${folderId}' in parents and trashed=false\`,
          fields: 'files(id, name, mimeType)',
          pageSize: 10,
        });
        
        const items = response.data.files || [];
        const folders = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        
        console.log(\`📁 \${folderName}\`);
        console.log(\`   アイテム数: \${items.length}\`);
        console.log(\`   子フォルダ数: \${folders.length}\`);
        
        if (items.length > 0) {
          console.log(\`   ✅ アクセス可能\`);
        } else {
          console.log(\`   ❌ アクセス不可（共有設定を確認）\`);
        }
        console.log();
        
      } catch (error) {
        console.log(\`📁 \${folderName}\`);
        console.log(\`   ❌ エラー: \${error.message}\`);
        console.log();
      }
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

checkAccess().then(() => process.exit(0));
"
```

**期待される結果**:
```
========================================
フォルダアクセス確認
========================================

📁 y.otomo@oneloopinc.net
   アイテム数: 15
   子フォルダ数: 3
   ✅ アクセス可能

📁 t.sakai@oneloopinc.net
   アイテム数: 12
   子フォルダ数: 2
   ✅ アクセス可能
...
```

---

### ステップ4: 共有完了後、テスト再実行

```bash
cd /opt/render/project/src

CURRENT_MONTH=$(date -u +"%Y-%m")
echo "Processing month: $CURRENT_MONTH"

node -e "
import { runSalesEvaluation } from './src/jobs/salesEvaluation.js';

runSalesEvaluation('$CURRENT_MONTH')
  .then(() => {
    console.log('✅ Sales evaluation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Sales evaluation failed:', error);
    process.exit(1);
  });
"
```

---

## 📝 補足情報

### Q1: すべてのフォルダに共有が必要ですか？
**A**: はい、評価対象の4つすべてのフォルダに共有が必要です。

### Q2: 子フォルダにも個別に共有が必要ですか？
**A**: いいえ、親フォルダに共有すれば、子フォルダにも権限が継承されます（通常）。

### Q3: 権限は「閲覧者」で良いですか？
**A**: はい、読み取り専用でOKです。APIは動画を読み取るだけです。

### Q4: 共有後、どれくらいで反映されますか？
**A**: 通常は即座に反映されます。数分待っても反映されない場合は、Render のサービスを再起動してください。

---

## 🚨 トラブルシューティング

### まだアイテム数が0の場合

1. **サービスアカウントのメールアドレスを再確認**:
   ```bash
   cd /opt/render/project/src
   echo $GOOGLE_SERVICE_ACCOUNT_EMAIL
   ```

2. **Google Drive で共有リストを確認**:
   - フォルダを開く
   - 右クリック → 「共有」
   - サービスアカウントのメールが表示されているか確認

3. **フォルダの所有者に確認**:
   - 共有の招待メールが届いているか
   - 承認が必要な場合は承認する

---

## 次のステップ

1. サービスアカウントのメールアドレスを確認
2. 4つのフォルダすべてに共有
3. 確認コマンドを実行
4. アクセス可能になったら、テスト再実行

実行結果を教えてください！
