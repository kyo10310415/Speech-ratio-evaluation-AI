import { pathToFileURL } from 'node:url';
import { driveService } from './services/driveService.js';

// Read-only diagnostic. Never print file names, IDs, provider responses or errors.
export async function debugVideoDates() {
  const folderId = process.env.VIDEO_DATE_DEBUG_FOLDER_ID;
  const month = process.env.VIDEO_DATE_DEBUG_MONTH || '2026-01';
  if (!folderId || !/^[A-Za-z0-9_-]+$/.test(folderId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Diagnostic target configuration is required');
  }
  await driveService.initialize();
  const folders = await driveService.drive.files.list({
    q: `'${folderId}' in parents and name='${month}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)', pageSize: 2,
  });
  const target = folders.data.files?.[0];
  if (!target) { console.log('対象月フォルダが見つかりません'); return; }
  let total = 0, invalidDates = 0, differentDates = 0, pageToken;
  do {
    const result = await driveService.drive.files.list({
      q: `'${target.id}' in parents and trashed=false and (mimeType='video/mp4' or mimeType='video/quicktime')`,
      fields: 'nextPageToken, files(createdTime)', orderBy: 'createdTime desc', pageSize: 1000, pageToken,
    });
    for (const file of result.data.files || []) {
      total++;
      const date = new Date(file.createdTime || '');
      if (!Number.isFinite(date.getTime())) { invalidDates++; continue; }
      const utcDay = date.toISOString().slice(0, 10);
      const jstDay = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (utcDay !== jstDay) differentDates++;
    }
    pageToken = result.data.nextPageToken;
  } while (pageToken);
  console.log(`動画件数: ${total}`);
  console.log(`作成日時が不明な件数: ${invalidDates}`);
  console.log(`UTCとJSTで日付が異なる件数: ${differentDates}`);
}

export async function runVideoDateDiagnostic() {
  try { await debugVideoDates(); return true; }
  catch { console.error('動画日付の確認に失敗しました。対象設定とアクセス権を確認してください。'); return false; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVideoDateDiagnostic().then(success => { if (!success) process.exitCode = 1; });
}
