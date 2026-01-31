/**
 * Google Apps Script to incrementally copy lesson folders to My Drive
 * 改善版: 既存ファイルはスキップ、新しいファイルのみコピー
 * 
 * 使い方:
 * 1. Google Drive で新しいスプレッドシートを作成
 * 2. 拡張機能 > Apps Script を開く
 * 3. このコードを貼り付け
 * 4. copyAllFoldersIncremental() を実行
 * 
 * 改善点:
 * - 既存フォルダを再利用（新規作成しない）
 * - 既存ファイルはスキップ（ファイル名でチェック）
 * - 新しいファイルのみコピー
 */

// スプレッドシートのID（シート1があるスプレッドシート）
const SHEET_ID = '1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo';

// コピー先の親フォルダID（マイドライブ内に作成したフォルダ）
// 例: マイドライブに "WannaV_Lessons_Copy" フォルダを作成し、そのIDを指定
const DESTINATION_PARENT_ID = 'YOUR_DESTINATION_FOLDER_ID_HERE';

/**
 * メイン関数: 全講師のフォルダを差分コピー
 */
function copyAllFoldersIncremental() {
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
  const newFolderUrlColIndex = headers.indexOf('新しいフォルダURL'); // 新しい列
  
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
    const existingNewUrl = row[newFolderUrlColIndex] || ''; // 既存のコピー先URL
    
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
      
      // 既存のコピー先フォルダを取得または新規作成
      let tutorFolder;
      if (existingNewUrl) {
        // 既存フォルダを使用
        const existingFolderId = extractFolderId(existingNewUrl);
        if (existingFolderId) {
          try {
            tutorFolder = DriveApp.getFolderById(existingFolderId);
            Logger.log(`  既存フォルダを使用: ${tutorFolder.getName()}`);
          } catch (error) {
            Logger.log(`  既存フォルダが見つからない、新規作成します`);
            tutorFolder = destinationParent.createFolder(tutorName);
          }
        } else {
          tutorFolder = destinationParent.createFolder(tutorName);
        }
      } else {
        // 新規作成
        tutorFolder = destinationParent.createFolder(tutorName);
        Logger.log(`  新規フォルダ作成: ${tutorFolder.getName()}`);
      }
      
      // 差分コピー
      const stats = copyFolderContentsIncremental(sourceFolder, tutorFolder);
      
      // 新しいフォルダURLを取得
      const newUrl = tutorFolder.getUrl();
      Logger.log(`  ✅ 完了: ${newUrl}`);
      Logger.log(`  統計: ${stats.newFiles} 新規, ${stats.skippedFiles} スキップ`);
      
      // スプレッドシートのC列（新しいフォルダURL）を更新
      if (newFolderUrlColIndex !== -1) {
        sheet.getRange(i + 1, newFolderUrlColIndex + 1).setValue(newUrl);
      }
      
    } catch (error) {
      Logger.log(`  ❌ エラー: ${error.message}`);
    }
  }
  
  Logger.log('\n=== 全て完了 ===');
}

/**
 * フォルダの中身を差分コピー（既存ファイルはスキップ）
 */
function copyFolderContentsIncremental(sourceFolder, destFolder) {
  const stats = {
    newFiles: 0,
    skippedFiles: 0,
    newFolders: 0,
  };
  
  // 既存ファイル名のセットを作成（高速検索用）
  const existingFileNames = new Set();
  const existingFiles = destFolder.getFiles();
  while (existingFiles.hasNext()) {
    existingFileNames.add(existingFiles.next().getName());
  }
  
  // 既存フォルダ名のマップを作成
  const existingFolderMap = new Map();
  const existingFolders = destFolder.getFolders();
  while (existingFolders.hasNext()) {
    const folder = existingFolders.next();
    existingFolderMap.set(folder.getName(), folder);
  }
  
  // サブフォルダをコピー
  const subFolders = sourceFolder.getFolders();
  while (subFolders.hasNext()) {
    const subFolder = subFolders.next();
    const subFolderName = subFolder.getName();
    
    let destSubFolder;
    if (existingFolderMap.has(subFolderName)) {
      // 既存のサブフォルダを使用
      destSubFolder = existingFolderMap.get(subFolderName);
      Logger.log(`    - サブフォルダ（既存）: ${subFolderName}`);
    } else {
      // 新規サブフォルダを作成
      destSubFolder = destFolder.createFolder(subFolderName);
      stats.newFolders++;
      Logger.log(`    - サブフォルダ（新規）: ${subFolderName}`);
    }
    
    // 再帰的にコピー
    const subStats = copyFolderContentsIncremental(subFolder, destSubFolder);
    stats.newFiles += subStats.newFiles;
    stats.skippedFiles += subStats.skippedFiles;
    stats.newFolders += subStats.newFolders;
  }
  
  // ファイルをコピー（既存はスキップ）
  const files = sourceFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    
    if (existingFileNames.has(fileName)) {
      // 既存ファイルはスキップ
      stats.skippedFiles++;
    } else {
      // 新しいファイルをコピー
      file.makeCopy(fileName, destFolder);
      stats.newFiles++;
    }
  }
  
  if (stats.newFiles > 0 || stats.skippedFiles > 0) {
    Logger.log(`    - ${stats.newFiles} ファイルをコピー, ${stats.skippedFiles} スキップ`);
  }
  
  return stats;
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
 * テスト用: 1人だけ差分コピー
 */
function testCopySingleFolderIncremental() {
  const testUrl = 'https://drive.google.com/drive/folders/18mhFqciItIbBka1Y9N1sGkHGKMq4gnJX';
  const testName = 'きょうへい先生_test';
  const existingFolderUrl = ''; // 既存フォルダのURL（あれば）
  
  const sourceFolderId = extractFolderId(testUrl);
  const sourceFolder = DriveApp.getFolderById(sourceFolderId);
  
  const destinationParent = DriveApp.getFolderById(DESTINATION_PARENT_ID);
  
  let tutorFolder;
  if (existingFolderUrl) {
    const existingId = extractFolderId(existingFolderUrl);
    tutorFolder = DriveApp.getFolderById(existingId);
    Logger.log(`既存フォルダを使用: ${tutorFolder.getName()}`);
  } else {
    tutorFolder = destinationParent.createFolder(testName);
    Logger.log(`新規フォルダ作成: ${tutorFolder.getName()}`);
  }
  
  const stats = copyFolderContentsIncremental(sourceFolder, tutorFolder);
  
  Logger.log(`\nテスト完了: ${tutorFolder.getUrl()}`);
  Logger.log(`統計: ${stats.newFiles} 新規, ${stats.skippedFiles} スキップ, ${stats.newFolders} フォルダ`);
}

/**
 * 【補足】C列に新しいフォルダURLを記録する列を追加する方法
 * 
 * スプレッドシートに「新しいフォルダURL」列を追加してください：
 * 
 * A列: tutor_name
 * B列: recording_folder_url（元のフォルダURL）
 * C列: 新しいフォルダURL（コピー先のフォルダURL）← この列を追加
 * 
 * ヘッダー行（1行目）に「新しいフォルダURL」と入力してください。
 */
