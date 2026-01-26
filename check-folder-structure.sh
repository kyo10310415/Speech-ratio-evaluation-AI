# セールスフォルダ構造確認スクリプト

cd /opt/render/project/src

# 各フォルダの構造を確認
node -e "
import { driveService } from './src/services/driveService.js';
import { sheetsService } from './src/services/sheetsService.js';
import { logger } from './src/utils/logger.js';

async function checkFolderStructure() {
  try {
    await sheetsService.initialize();
    await driveService.initialize();
    
    const data = await sheetsService.getSheetData('セールスフォルダ');
    
    if (data.length <= 1) {
      console.log('❌ No folders found in セールスフォルダ sheet');
      return;
    }
    
    console.log('========================================');
    console.log('フォルダ構造チェック');
    console.log('========================================\n');
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const folderName = row[0];
      const folderUrl = row[1];
      
      if (!folderUrl || folderUrl.trim() === '') continue;
      
      console.log(\`📁 フォルダ: \${folderName}\`);
      console.log(\`   URL: \${folderUrl}\`);
      
      try {
        const folderId = driveService.extractFolderId(folderUrl);
        console.log(\`   ID: \${folderId}\`);
        
        // List all items in folder
        const response = await driveService.drive.files.list({
          q: \`'\${folderId}' in parents and trashed=false\`,
          fields: 'files(id, name, mimeType, createdTime)',
          orderBy: 'createdTime desc',
          pageSize: 100,
        });
        
        const items = response.data.files || [];
        console.log(\`   アイテム数: \${items.length}\`);
        
        // Count folders and files
        const folders = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        const videos = items.filter(f => 
          f.mimeType.startsWith('video/') || 
          f.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)
        );
        
        console.log(\`   子フォルダ数: \${folders.length}\`);
        console.log(\`   動画ファイル数: \${videos.length}\`);
        
        if (folders.length > 0) {
          console.log(\`   子フォルダ一覧:\`);
          folders.slice(0, 5).forEach(f => {
            console.log(\`     - \${f.name}\`);
          });
          if (folders.length > 5) {
            console.log(\`     ... and \${folders.length - 5} more\`);
          }
        }
        
        if (videos.length > 0) {
          console.log(\`   動画ファイル一覧:\`);
          videos.slice(0, 5).forEach(f => {
            const date = new Date(f.createdTime);
            console.log(\`     - \${f.name} (\${date.toISOString().split('T')[0]})\`);
          });
          if (videos.length > 5) {
            console.log(\`     ... and \${videos.length - 5} more\`);
          }
        }
        
        console.log();
        
      } catch (error) {
        console.log(\`   ❌ エラー: \${error.message}\`);
        console.log();
      }
    }
    
    console.log('========================================');
    
  } catch (error) {
    console.error('Failed:', error);
  }
}

checkFolderStructure().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
"
