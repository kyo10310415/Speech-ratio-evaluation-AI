/**
 * Google Apps Script: WannaV Lesson Folder Sync System (最新2ヶ月のみ)
 * 
 * 変更点: 各講師の最新2つの月フォルダのみをコピー
 * タイムアウト対策
 */

// === 設定 ===
const SHEET_ID = '1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo';
const DESTINATION_PARENT_ID = 'YOUR_DESTINATION_FOLDER_ID_HERE';

// 列番号の設定（0始まり: A=0, B=1, C=2, D=3）
const FOLDER_URL_COLUMN = 2;  // C列
const TUTOR_NAME_COLUMN = 3;  // D列

// コピーする月フォルダの数
const MAX_MONTH_FOLDERS = 2;  // 最新2ヶ月

// === メイン関数 ===

/**
 * 初回セットアップ: 各講師の最新2ヶ月のみコピー
 */
function setupInitialSync() {
  Logger.log('=== 初回セットアップ開始（最新2ヶ月のみ）===\n');
  
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
      
      // 最新2ヶ月のフォルダのみをコピー
      const stats = syncLatestMonthFolders(sourceFolder, tutorFolder, MAX_MONTH_FOLDERS);
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
 * 最新N個の月フォルダのみを同期
 */
function syncLatestMonthFolders(sourceFolder, destFolder, maxFolders) {
  const stats = {
    newFiles: 0,
    skippedFiles: 0,
    folders: 0
  };
  
  // 全てのサブフォルダを取得
  const allSubFolders = [];
  const subFoldersIterator = sourceFolder.getFolders();
  while (subFoldersIterator.hasNext()) {
    allSubFolders.push(subFoldersIterator.next());
  }
  
  // 月フォルダのみをフィルタして正規化
  const monthFolders = [];
  for (const folder of allSubFolders) {
    const folderName = folder.getName();
    const normalized = normalizeMonthFolderName(folderName);
    
    if (normalized) {
      monthFolders.push({
        folder: folder,
        originalName: folderName,
        normalizedName: normalized
      });
    }
  }
  
  // 正規化された名前でソート（降順 = 新しい順）
  monthFolders.sort((a, b) => b.normalizedName.localeCompare(a.normalizedName));
  
  // 最新N個のみを選択
  const latestFolders = monthFolders.slice(0, maxFolders);
  
  if (latestFolders.length > 0) {
    Logger.log(`  最新${latestFolders.length}ヶ月を同期: ${latestFolders.map(f => f.originalName).join(', ')}`);
  } else {
    Logger.log(`  月フォルダが見つかりません`);
  }
  
  // 選択されたフォルダのみを同期
  for (const monthFolderInfo of latestFolders) {
    const subFolder = monthFolderInfo.folder;
    const folderName = monthFolderInfo.originalName;
    
    // コピー先のサブフォルダを取得または作成
    let destSubFolder;
    const existingSubFolders = destFolder.getFoldersByName(folderName);
    
    if (existingSubFolders.hasNext()) {
      destSubFolder = existingSubFolders.next();
    } else {
      destSubFolder = destFolder.createFolder(folderName);
      stats.folders++;
    }
    
    // フォルダ内容を同期
    const subStats = syncFolderContents(subFolder, destSubFolder);
    stats.newFiles += subStats.newFiles;
    stats.skippedFiles += subStats.skippedFiles;
  }
  
  return stats;
}

/**
 * フォルダ名を yyyy-mm 形式に正規化
 * サポート: yyyy-mm, yyyy年mm月, yyyy年m月
 */
function normalizeMonthFolderName(folderName) {
  // Pattern 1: yyyy-mm (e.g., "2026-01")
  const pattern1 = /^(\d{4})-(\d{2})$/;
  const match1 = folderName.match(pattern1);
  if (match1) {
    return `${match1[1]}-${match1[2]}`;
  }

  // Pattern 2: yyyy年mm月 or yyyy年m月 (e.g., "2025年11月", "2025年9月")
  const pattern2 = /^(\d{4})年(\d{1,2})月$/;
  const match2 = folderName.match(pattern2);
  if (match2) {
    const year = match2[1];
    const month = match2[2].padStart(2, '0');
    return `${year}-${month}`;
  }

  return null;
}

/**
 * フォルダ内容を同期（増分）- 再帰なし
 */
function syncFolderContents(sourceFolder, destFolder) {
  const stats = {
    newFiles: 0,
    skippedFiles: 0
  };
  
  // 既存ファイルのマップを作成（高速化）
  const existingFiles = {};
  const destFiles = destFolder.getFiles();
  while (destFiles.hasNext()) {
    const file = destFiles.next();
    const key = `${file.getName()}_${file.getSize()}`;
    existingFiles[key] = true;
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
 * 日次同期: 最新2ヶ月の新しいファイルのみコピー
 */
function dailySync() {
  Logger.log('=== 日次同期開始（最新2ヶ月のみ）===');
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
      
      const stats = syncLatestMonthFolders(sourceFolder, destFolder, MAX_MONTH_FOLDERS);
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
