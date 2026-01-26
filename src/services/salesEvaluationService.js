import { logger } from '../utils/logger.js';
import { driveService } from './driveService.js';
import { audioService } from './audioService.js';
import { transcriptionService } from './transcriptionService.js';
import { emotionAnalyzer } from '../analyzers/emotionAnalyzer.js';
import { geminiService } from './geminiService.js';

/**
 * Sales Evaluation Service
 * Evaluates sales call recordings and provides feedback
 */
class SalesEvaluationService {
  /**
   * List all subfolders in a parent folder
   * @param {string} parentFolderId 
   * @returns {Array} Array of subfolders
   */
  async listSubfolders(parentFolderId) {
    try {
      await driveService.initialize();
      
      const query = [
        `'${parentFolderId}' in parents`,
        `mimeType='application/vnd.google-apps.folder'`,
        `trashed=false`,
      ].join(' and ');

      const response = await driveService.drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime)',
        orderBy: 'name',
      });

      const folders = response.data.files || [];
      logger.info(`Found ${folders.length} subfolders in ${parentFolderId}`);
      
      return folders.map(f => ({
        id: f.id,
        name: f.name,
        createdTime: f.createdTime,
      }));
    } catch (error) {
      logger.error(`Failed to list subfolders in ${parentFolderId}`, error);
      throw error;
    }
  }

  /**
   * List video files in a folder for current month
   * @param {string} folderId 
   * @param {string} monthStr - Format: 'YYYY-MM'
   * @returns {Array} Array of video files
   */
  async listVideosInCurrentMonth(folderId, monthStr) {
    try {
      await driveService.initialize();
      
      // Calculate date range for current month
      const [year, month] = monthStr.split('-');
      const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
      const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59));

      const query = [
        `'${folderId}' in parents`,
        `mimeType contains 'video/'`,
        `trashed=false`,
        `createdTime >= '${startDate.toISOString()}'`,
        `createdTime <= '${endDate.toISOString()}'`,
      ].join(' and ');

      const response = await driveService.drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime, size, mimeType)',
        orderBy: 'createdTime desc',
      });

      const videos = response.data.files || [];
      logger.info(`Found ${videos.length} videos in ${folderId} for month ${monthStr}`);
      
      return videos;
    } catch (error) {
      logger.error(`Failed to list videos in ${folderId}`, error);
      throw error;
    }
  }

  /**
   * Randomly select one video from array
   * @param {Array} videos 
   * @returns {Object} Selected video
   */
  selectRandomVideo(videos) {
    if (videos.length === 0) return null;
    if (videos.length === 1) return videos[0];
    
    const randomIndex = Math.floor(Math.random() * videos.length);
    return videos[randomIndex];
  }

  /**
   * Analyze sales call recording
   * @param {Object} params
   * @returns {Object} Analysis result
   */
  async analyzeSalesCall(params) {
    const {
      subfolder,
      parentFolderUrl,
      videoFile,
      monthStr,
    } = params;

    try {
      logger.info(`Analyzing sales call: ${videoFile.name}`);

      // Download video
      const videoPath = await driveService.downloadFile(videoFile.id, videoFile.name);
      logger.info(`Downloaded video: ${videoPath}`);

      // Extract and normalize audio
      const { audioPath, duration } = await audioService.extractAndNormalizeAudio(videoPath);
      logger.info(`Extracted audio: ${audioPath}, duration: ${duration}s`);

      // Transcribe audio
      const { utterances } = await transcriptionService.transcribeAndDiarize(audioPath, duration);
      
      if (!utterances || utterances.length === 0) {
        throw new Error('No utterances found in transcription');
      }

      logger.info(`Transcribed ${utterances.length} utterances`);

      // Analyze sales performance
      const salesAnalysis = await this.analyzeSalesPerformance(utterances, duration);

      // Analyze emotions
      const emotions = await emotionAnalyzer.analyzeEmotionalSignals(utterances);

      // Generate report
      const report = await this.generateSalesReport(salesAnalysis, emotions);

      // Cleanup
      await audioService.cleanup(videoPath, audioPath);

      return {
        subfolder: subfolder.name,
        parentFolderUrl,
        fileId: videoFile.id,
        fileName: videoFile.name,
        createdTime: videoFile.createdTime,
        duration,
        ...salesAnalysis,
        ...emotions,
        report,
        monthStr,
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to analyze sales call: ${videoFile.name}`, error);
      
      return {
        subfolder: subfolder.name,
        parentFolderUrl,
        fileId: videoFile.id,
        fileName: videoFile.name,
        createdTime: videoFile.createdTime,
        monthStr,
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Analyze sales performance from utterances
   * @param {Array} utterances 
   * @param {number} duration 
   * @returns {Object} Sales performance metrics
   */
  async analyzeSalesPerformance(utterances, duration) {
    // Calculate talk ratio
    const speakerA = utterances.filter(u => u.speaker === 'A');
    const speakerB = utterances.filter(u => u.speaker === 'B');
    
    const speakerATime = speakerA.reduce((sum, u) => sum + (u.end - u.start), 0);
    const speakerBTime = speakerB.reduce((sum, u) => sum + (u.end - u.start), 0);
    
    const talkRatioSales = speakerATime / (speakerATime + speakerBTime);
    const talkRatioCustomer = speakerBTime / (speakerATime + speakerBTime);

    // Calculate question count (utterances ending with '?')
    const questionsAsked = speakerA.filter(u => u.text.includes('？') || u.text.includes('?')).length;

    // Calculate longest monologue
    let maxMonologueSec = 0;
    for (const u of speakerA) {
      const duration = u.end - u.start;
      if (duration > maxMonologueSec) {
        maxMonologueSec = duration;
      }
    }

    return {
      duration_sec: Math.round(duration),
      talk_ratio_sales: parseFloat(talkRatioSales.toFixed(3)),
      talk_ratio_customer: parseFloat(talkRatioCustomer.toFixed(3)),
      sales_speaking_sec: Math.round(speakerATime),
      customer_speaking_sec: Math.round(speakerBTime),
      questions_asked: questionsAsked,
      max_sales_monologue_sec: Math.round(maxMonologueSec),
      customer_turns: speakerB.length,
    };
  }

  /**
   * Generate sales report using Gemini
   * @param {Object} salesAnalysis 
   * @param {Object} emotions 
   * @returns {string} Report text
   */
  async generateSalesReport(salesAnalysis, emotions) {
    const prompt = `
あなたはセールストレーニングの専門家です。以下の営業通話の分析結果に基づいて、改善アドバイスを生成してください。

## 分析データ
- 営業担当者の発話比率: ${(salesAnalysis.talk_ratio_sales * 100).toFixed(1)}%
- 顧客の発話比率: ${(salesAnalysis.talk_ratio_customer * 100).toFixed(1)}%
- 質問回数: ${salesAnalysis.questions_asked}回
- 最長モノローグ: ${salesAnalysis.max_sales_monologue_sec}秒
- 顧客の発言回数: ${salesAnalysis.customer_turns}回

## 感情分析
- 混乱シグナル: ${(emotions.confusion_ratio_est * 100).toFixed(1)}%
- ストレスシグナル: ${(emotions.stress_ratio_est * 100).toFixed(1)}%
- ポジティブシグナル: ${(emotions.positive_ratio_est * 100).toFixed(1)}%

## 出力形式
以下の項目について、簡潔に（各100文字以内で）アドバイスしてください：

1. 傾聴力: 顧客の話を聞く姿勢について
2. 質問力: ヒアリングの質と量について
3. 説明力: 説明のわかりやすさと長さについ
4. 顧客体験: 顧客が感じたと思われる印象について
5. 改善提案: 最も重要な改善ポイント3つ

JSON形式で出力してください：
{
  "listening": "...",
  "questioning": "...",
  "explanation": "...",
  "customer_experience": "...",
  "improvements": ["...", "...", "..."]
}
`;

    try {
      const response = await geminiService.generateContent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const report = JSON.parse(jsonMatch[0]);
        return report;
      }
      return { error: 'Failed to parse report' };
    } catch (error) {
      logger.error('Failed to generate sales report', error);
      return { error: error.message };
    }
  }
}

export const salesEvaluationService = new SalesEvaluationService();
