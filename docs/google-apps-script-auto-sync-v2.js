/**
 * Google Apps Script: WannaV Lesson Folder Sync System (列番号指定版)
 * 
 * 変更点: ヘッダー名ではなく列番号を直接指定
 * C列 = 2 (0始まりなので)
 * D列 = 3
 */

// === 設定 ===
const SHEET_ID = '1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo';
const DESTINATION_PARENT_ID = 'YOUR_DESTINATION_FOLDER_ID_HERE';

// 列番号の設定（0始まり: A=0, B=1, C=2, D=3）
const FOLDER_URL_COLUMN = 2;  // C列
const TUTOR_NAME_COLUMN = 3;  // D列

// === メイン関数 ===

/**
 * 初回セットアップ: 全フォルダ・ファイルをコピー
 */
function setupInitialSync() {
  Logger.log('=== 初回セットアップ開始 ===\n');
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('シート1');
  
  if (!sheet) {
    throw new Error('シート1が見つかりません');
  }
  
  const data = sheet.getDataRange().getValues();
  const destinationParent = DriveApp.getFolderById(DESTINATION_PARENT_ID);
  
  const properties = PropertiesService.getScriptProperties();
  const folderMapping = {};
  
  // ヘッダー行（1行目）をスキップして処理
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const folderUrl = row[FOLDER_URL_COLUMN];
    const tutorName = row[TUTOR_NAME_COLUMN];
    
    if (!folderUrl || !tutorName) {
      Logger.log(`行 ${i + 1}: スキップ（データ不足）`);
      continue;
    }
    
    try {
      Logger.log(`\n[${i}/${data.length - 1}] ${tutorName}`);
      
      const sourceFolderId = extractFolderId(folderUrl);
      if (!sourceFolderId) {
        Logger.log('  ❌ 無効なURL');
        continue;
      }
      
      const sourceFolder = DriveApp.getFolderById(sourceFolderId);
      Logger.log(`  元フォルダ: ${sourceFolder.getName()}`);
      
      // コピー先フォルダを作成または取得
      let tutorFolder;
      const existingFolders = destinationParent.getFoldersByName(tutorName);
      
      if (existingFolders.hasNext()) {
        tutorFolder = existingFolders.next();
        Logger.log(`  既存フォルダを使用`);
      } else {
        tutorFolder = destinationParent.createFolder(tutorName);
        Logger.log(`  新規フォルダ作成`);
      }
      
      // フォルダ構造をコピー（増分）
      const stats = syncFolderContents(sourceFolder, tutorFolder);
      Logger.log(`  📊 新規: ${stats.newFiles} / スキップ: ${stats.skippedFiles} / フォルダ: ${stats.folders}`);
      
      // 新しいURLを取得
      const newUrl = tutorFolder.getUrl();
      const newFolderId = tutorFolder.getId();
      
      // マッピングを保存
      folderMapping[sourceFolderId] = {
        destId: newFolderId,
        tutorName: tutorName,
        sourceUrl: folderUrl,
        destUrl: newUrl
      };
      
      // スプレッドシートを更新
      sheet.getRange(i + 1, FOLDER_URL_COLUMN + 1).setValue(newUrl);
      Logger.log(`  ✅ 完了`);
      
    } catch (error) {
      Logger.log(`  ❌ エラー: ${error.message}`);
    }
  }
  
  // マッピングをプロパティに保存
  properties.setProperty('FOLDER_MAPPING', JSON.stringify(folderMapping));
  
  Logger.log('\n=== 初回セットアップ完了 ===');
  Logger.log('次回から dailySync() で増分同期できます');
}

/**
 * 日次同期: 新しいファイルのみコピー
 */
function dailySync() {
  Logger.log('=== 日次同期開始 ===');
  Logger.log(`実行時刻: ${new Date()}\n`);
  
  const properties = PropertiesService.getScriptProperties();
  const mappingJson = properties.getProperty('FOLDER_MAPPING');
  
  if (!mappingJson) {
    Logger.log('❌ 初回セットアップが必要です。setupInitialSync() を実行してください。');
    return;
  }
  
  const folderMapping = JSON.parse(mappingJson);
  let totalNewFiles = 0;
  let totalSkipped = 0;
  
  for (const sourceId in folderMapping) {
    const mapping = folderMapping[sourceId];
    
    try {
      Logger.log(`\n同期中: ${mapping.tutorName}`);
      
      const sourceFolder = DriveApp.getFolderById(sourceId);
      const destFolder = DriveApp.getFolderById(mapping.destId);
      
      const stats = syncFolderContents(sourceFolder, destFolder);
      totalNewFiles += stats.newFiles;
      totalSkipped += stats.skippedFiles;
      
      if (stats.newFiles > 0) {
        Logger.log(`  ✅ 新規ファイル: ${stats.newFiles}件`);
      } else {
        Logger.log(`  ✓ 変更なし`);
      }
      
    } catch (error) {
      Logger.log(`  ❌ エラー: ${error.message}`);
    }
  }
  
  Logger.log(`\n=== 日次同期完了 ===`);
  Logger.log(`新規ファイル: ${totalNewFiles}件`);
  Logger.log(`スキップ: ${totalSkipped}件`);
}

/**
 * フォルダ内容を同期（増分）
 */
function syncFolderContents(sourceFolder, destFolder) {
  const stats = {
    newFiles: 0,
    skippedFiles: 0,
    folders: 0
  };
  
  // 既存ファイルのマップを作成（高速化）
  const existingFiles = {};
  const destFiles = destFolder.getFiles();
  while (destFiles.hasNext()) {
    const file = destFiles.next();
    const key = `${file.getName()}_${file.getSize()}`;
    existingFiles[key] = true;
  }
  
  // サブフォルダを同期
  const subFolders = sourceFolder.getFolders();
  while (subFolders.hasNext()) {
    const subFolder = subFolders.next();
    const folderName = subFolder.getName();
    
    // コピー先のサブフォルダを取得または作成
    let destSubFolder;
    const existingSubFolders = destFolder.getFoldersByName(folderName);
    
    if (existingSubFolders.hasNext()) {
      destSubFolder = existingSubFolders.next();
    } else {
      destSubFolder = destFolder.createFolder(folderName);
      stats.folders++;
    }
    
    // 再帰的に同期
    const subStats = syncFolderContents(subFolder, destSubFolder);
    stats.newFiles += subStats.newFiles;
    stats.skippedFiles += subStats.skippedFiles;
    stats.folders += subStats.folders;
  }
  
  // ファイルを同期
  const files = sourceFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    const fileSize = file.getSize();
    const key = `${fileName}_${fileSize}`;
    
    if (existingFiles[key]) {
      stats.skippedFiles++;
    } else {
      file.makeCopy(fileName, destFolder);
      stats.newFiles++;
    }
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
 * 毎日午前8時（JST）に自動実行するトリガーを設定
 */
function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailySync') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('dailySync')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();
  
  Logger.log('✅ 毎日午前8時に dailySync() を実行するトリガーを設定しました');
}

/**
 * トリガーを削除
 */
function removeDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailySync') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('✅ トリガーを削除しました');
    }
  });
}

/**
 * 現在のトリガー一覧を表示
 */
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log(`=== トリガー一覧 (${triggers.length}件) ===`);
  
  triggers.forEach(trigger => {
    Logger.log(`関数: ${trigger.getHandlerFunction()}`);
    Logger.log(`種類: ${trigger.getEventType()}`);
    Logger.log('---');
  });
}
