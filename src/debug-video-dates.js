import { driveService } from './services/driveService.js';
import { config } from './config/env.js';

/**
 * Debug script to check actual video file creation dates
 */
async function debugVideoDates() {
  console.log('=== Video Date Debug ===\n');
  
  // Initialize Drive service
  await driveService.initialize();
  
  // きょうへい先生のフォルダID
  const folderId = '1OuyVHjShDKkrnZUR5IY--Qaa9DPVm3Sb';
  
  console.log(`Checking folder: ${folderId}\n`);
  
  // Get all subfolders
  const subfolders = await driveService.listMonthFolders(folderId);
  console.log(`Found ${subfolders.length} month folders:`);
  subfolders.forEach(f => console.log(`  - ${f.name} (${f.id})`));
  
  // Check 2026-01 folder
  const jan2026 = subfolders.find(f => f.name === '2026-01');
  if (!jan2026) {
    console.log('\n❌ 2026-01 folder not found');
    return;
  }
  
  console.log(`\n=== Checking files in 2026-01 folder ===`);
  
  // List all files with metadata
  const files = await driveService.drive.files.list({
    q: `'${jan2026.id}' in parents and trashed=false and (mimeType='video/mp4' or mimeType='video/quicktime')`,
    fields: 'files(id, name, createdTime, size, mimeType)',
    orderBy: 'createdTime desc',
  });
  
  if (!files.data.files || files.data.files.length === 0) {
    console.log('No video files found');
    return;
  }
  
  console.log(`Found ${files.data.files.length} video files:\n`);
  
  files.data.files.forEach(file => {
    const createdTime = new Date(file.createdTime);
    const jstTime = new Date(createdTime.getTime() + 9 * 60 * 60 * 1000); // Convert to JST
    
    console.log(`File: ${file.name}`);
    console.log(`  ID: ${file.id}`);
    console.log(`  Created (UTC): ${createdTime.toISOString()}`);
    console.log(`  Created (JST): ${jstTime.toISOString().replace('T', ' ').substring(0, 19)}`);
    console.log(`  Size: ${Math.round(file.size / 1024 / 1024)} MB`);
    console.log(`  Type: ${file.mimeType}`);
    console.log('');
  });
  
  console.log('=== Date Range for 2026-01-04 Test ===');
  console.log('Start: 2026-01-03T15:00:00.000Z (JST: 2026-01-04 00:00:00)');
  console.log('End:   2026-01-04T14:59:59.000Z (JST: 2026-01-04 23:59:59)');
  console.log('\n✅ Debug completed');
}

debugVideoDates().catch(console.error);
