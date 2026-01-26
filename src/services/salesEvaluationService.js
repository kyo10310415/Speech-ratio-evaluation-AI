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
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
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
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
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
      
      // Initialize services
      await audioService.initialize();
      await geminiService.initialize();

      // Download video
      const videoPath = await driveService.downloadFile(videoFile.id, videoFile.name);
      logger.info(`Downloaded video: ${videoPath}`);

      // Extract audio
      const audioPath = await audioService.extractAudio(videoPath, videoFile.id);
      logger.info(`Extracted audio: ${audioPath}`);
      
      // Get audio duration
      const duration = await audioService.getAudioDuration(audioPath);
      logger.info(`Audio duration: ${duration}s`);

      // Transcribe audio
      const { utterances } = await transcriptionService.transcribeAndDiarize(audioPath, duration);
      
      if (!utterances || utterances.length === 0) {
        throw new Error('No utterances found in transcription');
      }

      logger.info(`Transcribed ${utterances.length} utterances`);
      
      // Convert speaker_role to speaker (for compatibility with sales analysis)
      // Assumption: First speaker is Sales, second speaker is Customer
      const convertedUtterances = utterances.map(u => ({
        ...u,
        speaker: u.speaker_role === 'Tutor' ? 'A' : 'B', // Tutor=Sales(A), Student=Customer(B)
        start: u.start_ms / 1000, // Convert ms to seconds
        end: u.end_ms / 1000,
      }));

      // Analyze sales performance
      const salesAnalysis = await this.analyzeSalesPerformance(convertedUtterances, duration);

      // Analyze emotions (use original utterances with speaker_role)
      const emotions = await emotionAnalyzer.analyzeEmotionalSignals(utterances);
      
      // Convert emotion keys to snake_case for sheet compatibility
      const emotionsFormatted = {
        confusion_ratio_est: emotions.confusionRatioEst || 0,
        stress_ratio_est: emotions.stressRatioEst || 0,
        positive_ratio_est: emotions.positiveRatioEst || 0,
        confusion_top3: emotions.confusionTop3 || '',
        stress_top3: emotions.stressTop3 || '',
        positive_top3: emotions.positiveTop3 || '',
      };

      // Generate report
      const report = await this.generateSalesReport(salesAnalysis, emotionsFormatted);

      // Cleanup temporary files
      try {
        const { unlink } = await import('fs/promises');
        await unlink(videoPath).catch(err => logger.warn(`Failed to delete video: ${err.message}`));
        await unlink(audioPath).catch(err => logger.warn(`Failed to delete audio: ${err.message}`));
      } catch (cleanupError) {
        logger.warn('Cleanup failed', cleanupError);
      }

      return {
        subfolder: subfolder.name,
        parentFolderUrl,
        fileId: videoFile.id,
        fileName: videoFile.name,
        createdTime: videoFile.createdTime,
        duration,
        ...salesAnalysis,
        ...emotionsFormatted,
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
あなたはセールストレーニングの専門家です。以下の営業通話の分析結果に基づいて、詳細な改善アドバイスを生成してください。

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
以下の項目について、具体的かつ実践的なアドバイスを生成してください（各項目200-300文字）：

1. **傾聴力**: 
   - 現状の課題を具体的に指摘
   - 理想的な傾聴の姿勢とは何か
   - 実践的な改善方法（例：顧客の発話比率を〇〇%にするための具体策）

2. **質問力**: 
   - 現在の質問回数と質の評価
   - 効果的な質問の種類と使い分け（オープン/クローズド質問）
   - 顧客のニーズを引き出すための質問テクニック

3. **説明力**: 
   - 現在のモノローグ時間の問題点
   - 簡潔でわかりやすい説明のコツ
   - 顧客の理解度を確認しながら進める方法

4. **顧客体験**: 
   - 顧客が感じたと思われる感情（混乱/ストレス/満足度）
   - この通話で顧客が得られた価値
   - 顧客満足度を高めるための具体的施策

5. **改善提案**: 
   - 最も重要な改善ポイント3つ（優先順位付き）
   - それぞれの改善ポイントに対する具体的なアクションプラン
   - 成果を測定するKPI

JSON形式で出力してください：
{
  "listening": "...",
  "questioning": "...",
  "explanation": "...",
  "customer_experience": "...",
  "improvements": ["1. ...", "2. ...", "3. ..."]
}
`;

    try {
      // Use Gemini API to generate report
      const model = geminiService.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
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
