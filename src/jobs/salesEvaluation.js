import { logger } from '../utils/logger.js';
import { config, validateConfig } from '../config/env.js';
import { sheetsService } from '../services/sheetsService.js';
import { salesEvaluationService } from '../services/salesEvaluationService.js';
import { driveService } from '../services/driveService.js';

/**
 * Sales Evaluations Sheet Headers
 */
export const SALES_EVALUATIONS_HEADERS = [
  'month',
  'subfolder_name',
  'parent_folder_url',
  'file_id',
  'file_name',
  'created_time',
  'duration_sec',
  'talk_ratio_sales',
  'talk_ratio_customer',
  'sales_speaking_sec',
  'customer_speaking_sec',
  'questions_asked',
  'max_sales_monologue_sec',
  'customer_turns',
  'confusion_ratio_est',
  'stress_ratio_est',
  'positive_ratio_est',
  'listening_advice',
  'questioning_advice',
  'explanation_advice',
  'customer_experience',
  'improvements',
  'status',
  'error_message',
];

/**
 * Run sales evaluation for current month
 * @param {string} monthStr - Format: 'YYYY-MM'
 */
export async function runSalesEvaluation(monthStr) {
  const startTime = Date.now();
  
  try {
    logger.info('========================================');
    logger.info(`SALES EVALUATION STARTED for ${monthStr}`);
    logger.info('========================================');

    // Validate configuration
    validateConfig();

    // Initialize services
    await sheetsService.initialize();
    await driveService.initialize();

    // Get sales folders from sheet
    const salesFoldersData = await sheetsService.getSheetData('セールスフォルダ');
    
    if (salesFoldersData.length <= 1) {
      logger.warn('No sales folders found in セールスフォルダ sheet');
      return;
    }

    // Parse sales folders (skip header row)
    const salesFolders = [];
    for (let i = 1; i < salesFoldersData.length; i++) {
      const row = salesFoldersData[i];
      const folderUrl = row[1]; // B column
      
      if (folderUrl && folderUrl.trim() !== '') {
        salesFolders.push({
          name: row[0] || `Folder ${i}`,
          url: folderUrl.trim(),
        });
      }
    }

    logger.info(`Found ${salesFolders.length} sales folders to evaluate`);

    // Ensure sales_evaluations sheet exists
    await sheetsService.getOrCreateSheet('sales_evaluations');
    await sheetsService.writeHeaders('sales_evaluations', SALES_EVALUATIONS_HEADERS);

    // Process each sales folder
    const allResults = [];
    
    for (const folder of salesFolders) {
      try {
        logger.info(`Processing folder: ${folder.name}`);
        
        // Extract folder ID
        const folderId = driveService.extractFolderId(folder.url);
        
        // List subfolders
        const subfolders = await salesEvaluationService.listSubfolders(folderId);
        logger.info(`Found ${subfolders.length} subfolders in ${folder.name}`);
        
        // Process each subfolder
        for (const subfolder of subfolders) {
          try {
            // List videos in current month
            const videos = await salesEvaluationService.listVideosInCurrentMonth(
              subfolder.id,
              monthStr
            );
            
            if (videos.length === 0) {
              logger.info(`No videos found in subfolder ${subfolder.name} for ${monthStr}`);
              continue;
            }
            
            // Select random video
            const selectedVideo = salesEvaluationService.selectRandomVideo(videos);
            logger.info(`Selected video: ${selectedVideo.name} from ${subfolder.name}`);
            
            // Analyze sales call
            const result = await salesEvaluationService.analyzeSalesCall({
              subfolder,
              parentFolderUrl: folder.url,
              videoFile: selectedVideo,
              monthStr,
            });
            
            allResults.push(result);
            
            // Write result to sheet immediately
            const sheetRow = formatSalesEvaluationRow(result);
            await sheetsService.appendRows('sales_evaluations', [sheetRow]);
            logger.info(`✅ Wrote result to sheet: ${subfolder.name} - ${result.success ? 'SUCCESS' : 'FAILED'}`);
            
          } catch (error) {
            logger.error(`Failed to process subfolder ${subfolder.name}`, error);
            const errorResult = {
              subfolder: subfolder.name,
              parentFolderUrl: folder.url,
              monthStr,
              error: error.message,
              success: false,
            };
            allResults.push(errorResult);
            
            // Write error result to sheet immediately
            const sheetRow = formatSalesEvaluationRow(errorResult);
            await sheetsService.appendRows('sales_evaluations', [sheetRow]);
            logger.info(`❌ Wrote error to sheet: ${subfolder.name}`);
          }
        }
        
      } catch (error) {
        logger.error(`Failed to process folder ${folder.name}`, error);
      }
    }

    // Summary (no need to write again, already written incrementally)
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const successCount = allResults.filter(r => r.success).length;
    const failCount = allResults.filter(r => !r.success).length;
    
    logger.info('========================================');
    logger.info(`SALES EVALUATION COMPLETED in ${duration}s`);
    logger.info(`Processed ${allResults.length} sales calls`);
    logger.info(`Success: ${successCount}, Failed: ${failCount}`);
    logger.info('========================================');

  } catch (error) {
    logger.error('SALES EVALUATION FAILED:', error);
    throw error;
  }
}

/**
 * Format sales evaluation result for sheet row
 * @param {Object} result 
 * @returns {Array} Row data
 */
function formatSalesEvaluationRow(result) {
  if (!result.success) {
    return [
      result.monthStr || '',
      result.subfolder || '',
      result.parentFolderUrl || '',
      result.fileId || '',
      result.fileName || '',
      result.createdTime || '',
      0, // duration_sec
      0, // talk_ratio_sales
      0, // talk_ratio_customer
      0, // sales_speaking_sec
      0, // customer_speaking_sec
      0, // questions_asked
      0, // max_sales_monologue_sec
      0, // customer_turns
      0, // confusion_ratio_est
      0, // stress_ratio_est
      0, // positive_ratio_est
      '', // listening_advice
      '', // questioning_advice
      '', // explanation_advice
      '', // customer_experience
      '', // improvements
      'ERROR',
      result.error || 'Unknown error',
    ];
  }

  const report = result.report || {};
  
  return [
    result.monthStr,
    result.subfolder,
    result.parentFolderUrl,
    result.fileId,
    result.fileName,
    result.createdTime,
    result.duration_sec,
    result.talk_ratio_sales,
    result.talk_ratio_customer,
    result.sales_speaking_sec,
    result.customer_speaking_sec,
    result.questions_asked,
    result.max_sales_monologue_sec,
    result.customer_turns,
    result.confusion_ratio_est || 0,
    result.stress_ratio_est || 0,
    result.positive_ratio_est || 0,
    report.listening || '',
    report.questioning || '',
    report.explanation || '',
    report.customer_experience || '',
    Array.isArray(report.improvements) ? report.improvements.join('\n') : '',
    'OK',
    '',
  ];
}
