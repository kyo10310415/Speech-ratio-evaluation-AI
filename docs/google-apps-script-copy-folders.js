/**
 * Google Apps Script to copy lesson folders to My Drive
 * 
 * 使い方:
 * 1. Google Drive で新しいスプレッドシートを作成
 * 2. 拡張機能 > Apps Script を開く
 * 3. このコードを貼り付け
 * 4. copyAllFolders() を実行
 * 
 * 注意: 大量のファイルがある場合、時間がかかります
 */

// スプレッドシートのID（シート1があるスプレッドシート）
const SHEET_ID = '1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo';

// コピー先の親フォルダID（マイドライブ内に作成したフォルダ）
// 例: マイドライブに "WannaV_Lessons_Copy" フォルダを作成し、そのIDを指定
const DESTINATION_PARENT_ID = 'YOUR_DESTINATION_FOLDER_ID_HERE';

/**
 * メイン関数: 全講師のフォルダをコピー
 */
function copyAllFolders() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('シート1');
  
  if (!sheet) {
    Logger.log('シート1が見つかりません');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // C列とD列のインデックスを取得
  const folderUrlColIndex = headers.indexOf('recording_folder_url');
  const tutorNameColIndex = headers.indexOf('tutor_name');
  
  if (folderUrlColIndex === -1 || tutorNameColIndex === -1) {
    Logger.log('必要なカラムが見つかりません');
    return;
  }
  
  const destinationParent = DriveApp.getFolderById(DESTINATION_PARENT_ID);
  
  // ヘッダー行をスキップして各講師を処理
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const folderUrl = row[folderUrlColIndex];
    const tutorName = row[tutorNameColIndex];
    
    if (!folderUrl || !tutorName) {
      Logger.log(`行 ${i + 1}: スキップ（データ不足）`);
      continue;
    }
    
    try {
      Logger.log(`\n処理中: ${tutorName}`);
      
      // フォルダIDを抽出
      const sourceFolderId = extractFolderId(folderUrl);
      
      if (!sourceFolderId) {
        Logger.log(`  ❌ 無効なURL: ${folderUrl}`);
        continue;
      }
      
      // 元のフォルダを取得
      const sourceFolder = DriveApp.getFolderById(sourceFolderId);
      Logger.log(`  元のフォルダ: ${sourceFolder.getName()}`);
      
      // コピー先フォルダを作成（講師名）
      const tutorFolder = destinationParent.createFolder(tutorName);
      Logger.log(`  コピー先フォルダ作成: ${tutorFolder.getName()}`);
      
      // サブフォルダと中身を再帰的にコピー
      copyFolderContents(sourceFolder, tutorFolder);
      
      // 新しいフォルダURLを取得
      const newUrl = tutorFolder.getUrl();
      Logger.log(`  ✅ 完了: ${newUrl}`);
      
      // スプレッドシートのC列を更新
      sheet.getRange(i + 1, folderUrlColIndex + 1).setValue(newUrl);
      
    } catch (error) {
      Logger.log(`  ❌ エラー: ${error.message}`);
    }
  }
  
  Logger.log('\n=== 全て完了 ===');
}

/**
 * フォルダの中身を再帰的にコピー
 */
function copyFolderContents(sourceFolder, destFolder) {
  // サブフォルダをコピー
  const subFolders = sourceFolder.getFolders();
  while (subFolders.hasNext()) {
    const subFolder = subFolders.next();
    const newSubFolder = destFolder.createFolder(subFolder.getName());
    Logger.log(`    - サブフォルダ: ${subFolder.getName()}`);
    
    // 再帰的にコピー
    copyFolderContents(subFolder, newSubFolder);
  }
  
  // ファイルをコピー
  const files = sourceFolder.getFiles();
  let fileCount = 0;
  while (files.hasNext()) {
    const file = files.next();
    file.makeCopy(file.getName(), destFolder);
    fileCount++;
  }
  
  if (fileCount > 0) {
    Logger.log(`    - ${fileCount} ファイルをコピー`);
  }
}

/**
 * URLからフォルダIDを抽出
 */
function extractFolderId(url) {
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * テスト用: 1人だけコピー
 */
function testCopySingleFolder() {
  const testUrl = 'https://drive.google.com/drive/folders/18mhFqciItIbBka1Y9N1sGkHGKMq4gnJX';
  const testName = 'きょうへい先生_test';
  
  const sourceFolderId = extractFolderId(testUrl);
  const sourceFolder = DriveApp.getFolderById(sourceFolderId);
  
  const destinationParent = DriveApp.getFolderById(DESTINATION_PARENT_ID);
  const tutorFolder = destinationParent.createFolder(testName);
  
  copyFolderContents(sourceFolder, tutorFolder);
  
  Logger.log(`テスト完了: ${tutorFolder.getUrl()}`);
}
