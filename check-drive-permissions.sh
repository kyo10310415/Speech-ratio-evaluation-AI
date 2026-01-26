#!/bin/bash

# Google Drive 権限詳細チェックスクリプト
# Render Shell で実行

cd /opt/render/project/src

echo "========================================"
echo "Google Drive 権限詳細チェック"
echo "========================================"
echo ""

node -e "
import { driveService } from './src/services/driveService.js';
import { sheetsService } from './src/services/sheetsService.js';

async function checkPermissions() {
  try {
    await sheetsService.initialize();
    await driveService.initialize();
    
    const data = await sheetsService.getSheetData('セールスフォルダ');
    
    console.log('📋 サービスアカウント情報:');
    console.log('   Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.log('');
    
    // 最初のフォルダで詳細チェック
    const folderUrl = data[1][1];
    const folderName = data[1][0];
    const folderId = driveService.extractFolderId(folderUrl);
    
    console.log('🔍 テストフォルダ:', folderName);
    console.log('   ID:', folderId);
    console.log('');
    
    // フォルダのメタデータを取得
    try {
      const folderMeta = await driveService.drive.files.get({
        fileId: folderId,
        fields: 'id, name, mimeType, parents, capabilities, permissions, driveId, shared, ownedByMe',
        supportsAllDrives: true,
      });
      
      console.log('📁 フォルダ情報:');
      console.log('   名前:', folderMeta.data.name);
      console.log('   mimeType:', folderMeta.data.mimeType);
      console.log('   共有されている:', folderMeta.data.shared);
      console.log('   所有者:', folderMeta.data.ownedByMe ? '自分' : '他のユーザー');
      
      if (folderMeta.data.driveId) {
        console.log('   ⚠️  共有ドライブ内のフォルダです');
        console.log('   共有ドライブID:', folderMeta.data.driveId);
      } else {
        console.log('   ℹ️  マイドライブ内のフォルダです');
      }
      
      if (folderMeta.data.parents) {
        console.log('   親フォルダ:', folderMeta.data.parents.join(', '));
      }
      
      console.log('');
      console.log('🔐 権限情報:');
      console.log('   canListChildren:', folderMeta.data.capabilities?.canListChildren);
      console.log('   canReadRevisions:', folderMeta.data.capabilities?.canReadRevisions);
      console.log('   canShare:', folderMeta.data.capabilities?.canShare);
      console.log('');
      
    } catch (metaError) {
      console.log('❌ フォルダのメタデータ取得エラー:', metaError.message);
      console.log('');
    }
    
    // 共有ドライブとしてアクセスを試みる
    console.log('🔄 アクセステスト:');
    console.log('');
    
    // テスト1: 通常のアクセス
    console.log('1️⃣  通常のアクセス (supportsAllDrives: false):');
    try {
      const response1 = await driveService.drive.files.list({
        q: \`'\${folderId}' in parents and trashed=false\`,
        fields: 'files(id, name, mimeType)',
        pageSize: 10,
        supportsAllDrives: false,
      });
      console.log('   結果: アイテム数', response1.data.files?.length || 0);
    } catch (error) {
      console.log('   ❌ エラー:', error.message);
    }
    console.log('');
    
    // テスト2: 共有ドライブ対応
    console.log('2️⃣  共有ドライブ対応 (supportsAllDrives: true):');
    try {
      const response2 = await driveService.drive.files.list({
        q: \`'\${folderId}' in parents and trashed=false\`,
        fields: 'files(id, name, mimeType)',
        pageSize: 10,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      console.log('   結果: アイテム数', response2.data.files?.length || 0);
      
      if (response2.data.files && response2.data.files.length > 0) {
        console.log('   ✅ アクセス成功！');
        console.log('');
        console.log('   📂 最初の5個のアイテム:');
        response2.data.files.slice(0, 5).forEach((file, i) => {
          const type = file.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
          console.log(\`   \${i+1}. \${type} \${file.name}\`);
        });
      }
    } catch (error) {
      console.log('   ❌ エラー:', error.message);
    }
    console.log('');
    
    console.log('========================================');
    console.log('📝 結論:');
    console.log('');
    
    // 結論を表示
    try {
      const testResponse = await driveService.drive.files.list({
        q: \`'\${folderId}' in parents and trashed=false\`,
        fields: 'files(id)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      
      if (testResponse.data.files && testResponse.data.files.length > 0) {
        console.log('✅ 解決方法: supportsAllDrives: true を追加');
        console.log('');
        console.log('コード修正が必要です。');
        console.log('salesEvaluationService.js の listSubfolders 関数に');
        console.log('以下のパラメータを追加してください:');
        console.log('  - supportsAllDrives: true');
        console.log('  - includeItemsFromAllDrives: true');
      } else {
        console.log('❌ 権限の問題が残っています');
        console.log('');
        console.log('確認事項:');
        console.log('1. サービスアカウントが共有ドライブのメンバーか');
        console.log('2. 親フォルダの権限設定');
        console.log('3. 組織のセキュリティポリシー');
      }
    } catch (error) {
      console.log('❌ アクセステスト失敗');
    }
    
    console.log('========================================');
    
  } catch (error) {
    console.error('エラー:', error);
    console.error(error.stack);
  }
}

checkPermissions().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
"
