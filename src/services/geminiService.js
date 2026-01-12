import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import pRetry from 'p-retry';

class GeminiService {
  constructor() {
    this.genAI = null;
    this.fileManager = null;
  }

  /**
   * Initialize Gemini service
   */
  async initialize() {
    this.genAI = new GoogleGenerativeAI(config.googleAiApiKey);
    this.fileManager = new GoogleAIFileManager(config.googleAiApiKey);
    logger.info('Gemini AI service initialized');
  }

  /**
   * Transcribe audio file using Gemini
   * @param {string} audioPath 
   * @returns {Object} { segments: [...] }
   */
  async transcribeAudio(audioPath) {
    return pRetry(
      async () => {
        try {
          logger.info(`Transcribing audio with Gemini: ${audioPath}`);

          // Upload audio file
          const uploadResponse = await this.fileManager.uploadFile(audioPath, {
            mimeType: 'audio/wav',
            displayName: 'lesson_audio',
          });

          logger.info(`Audio uploaded: ${uploadResponse.file.uri}`);

          // Use Gemini 2.5 Flash for transcription (stable model)
          const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

          const prompt = `この音声ファイルは約${Math.round(readFileSync(audioPath).length / (1024 * 1024 * 10))}分のオンラインレッスンの録音です。
音声ファイル全体を最初から最後まで完全に文字起こししてください。

重要な要件:
1. **音声ファイルの最初から最後まで全て**を文字起こししてください（途中で終わらないこと）
2. 発話ごとにタイムスタンプ（秒単位）を含めてください
3. 話者が切り替わる箇所を認識してください（話者Aと話者Bの2人の会話）
4. 以下のJSON形式で出力してください:

{
  "segments": [
    {
      "start_sec": 0.0,
      "end_sec": 5.2,
      "text": "発話内容",
      "speaker": "A"
    },
    {
      "start_sec": 5.2,
      "end_sec": 12.8,
      "text": "次の発話内容",
      "speaker": "B"
    }
  ]
}

注意事項:
- 音声が長い場合でも、最後まで全て文字起こししてください
- 発話がない区間は省略してください
- 話者Aと話者Bのラベルを一貫して使用してください
- 日本語の発話を正確に文字起こししてください`;

          const result = await model.generateContent([
            {
              fileData: {
                mimeType: uploadResponse.file.mimeType,
                fileUri: uploadResponse.file.uri,
              },
            },
            { text: prompt },
          ]);

          const response = result.response;
          const text = response.text();

          logger.info(`Gemini response length: ${text.length} characters`);

          // Parse JSON response
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('Failed to parse transcription response');
          }

          const data = JSON.parse(jsonMatch[0]);

          // Convert to milliseconds
          const segments = data.segments.map(seg => ({
            start_ms: Math.round(seg.start_sec * 1000),
            end_ms: Math.round(seg.end_sec * 1000),
            text: seg.text.trim(),
            speaker: seg.speaker,
          }));

          logger.info(`Transcription complete: ${segments.length} segments`);

          // Clean up uploaded file
          await this.fileManager.deleteFile(uploadResponse.file.name);

          return { segments };
        } catch (error) {
          logger.error('Gemini transcription failed', error);
          throw error;
        }
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(
            `Transcription attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
          );
        },
      }
    );
  }

  /**
   * Analyze emotional signals using Gemini
   * @param {Array} utterances 
   * @returns {Object} Emotion analysis result
   */
  async analyzeEmotions(utterances) {
    return pRetry(
      async () => {
        try {
          logger.info('Analyzing emotions with Gemini');

          const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

          // Prepare transcript
          const transcript = utterances
            .map((u) => {
              const minutes = Math.floor(u.start_ms / 60000);
              const seconds = Math.floor((u.start_ms % 60000) / 1000);
              return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}] ${u.speaker_role}: ${u.text}`;
            })
            .join('\n');

          const prompt = `以下は1対1のオンラインレッスンの文字起こしです。Tutorは講師、Studentは生徒です。

文字起こし:
${transcript}

あなたのタスク:
1. **困惑シグナル (Confusion)**: 生徒が内容を理解できていない、混乱している兆候がある区間を特定してください
   - 例: "えーと"、"うーん"、"よくわからない"、質問の繰り返し、曖昧な返答
   
2. **ストレスシグナル (Stress)**: 生徒が緊張している、プレッシャーを感じている兆候がある区間を特定してください
   - 例: 返答の遅れ、言葉に詰まる、短い返答、回避的な態度
   
3. **ポジティブシグナル (Positive)**: 生徒が理解し、エンゲージしている兆候がある区間を特定してください
   - 例: "なるほど"、"わかりました"、積極的な質問、具体的な返答

以下のJSON形式で回答してください:
{
  "confusion_segments": [
    { "timestamp": "mm:ss", "reason": "根拠となる発言や状況" }
  ],
  "stress_segments": [
    { "timestamp": "mm:ss", "reason": "根拠となる発言や状況" }
  ],
  "positive_segments": [
    { "timestamp": "mm:ss", "reason": "根拠となる発言や状況" }
  ]
}

各カテゴリで最大3つまで、最も顕著な区間を特定してください。`;

          const result = await model.generateContent(prompt);
          const text = result.response.text();

          // Parse JSON
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('Failed to parse emotion analysis response');
          }

          const data = JSON.parse(jsonMatch[0]);

          // Calculate ratios
          const confusionRatio = Math.min((data.confusion_segments?.length || 0) / 10, 1);
          const stressRatio = Math.min((data.stress_segments?.length || 0) / 10, 1);
          const positiveRatio = Math.min((data.positive_segments?.length || 0) / 10, 1);

          logger.info('Emotion analysis complete');

          return {
            confusionRatioEst: parseFloat(confusionRatio.toFixed(3)),
            stressRatioEst: parseFloat(stressRatio.toFixed(3)),
            positiveRatioEst: parseFloat(positiveRatio.toFixed(3)),
            confusionTop3: this.formatSegments(data.confusion_segments?.slice(0, 3) || []),
            stressTop3: this.formatSegments(data.stress_segments?.slice(0, 3) || []),
            positiveTop3: this.formatSegments(data.positive_segments?.slice(0, 3) || []),
          };
        } catch (error) {
          logger.error('Emotion analysis failed', error);
          // Return defaults on error
          return {
            confusionRatioEst: 0,
            stressRatioEst: 0,
            positiveRatioEst: 0,
            confusionTop3: '',
            stressTop3: '',
            positiveTop3: '',
          };
        }
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(
            `Emotion analysis attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
          );
        },
      }
    );
  }

  /**
   * Generate improvement report using Gemini
   * @param {Object} kpis 
   * @param {Object} emotions 
   * @returns {Object} { improvementAdvice, recommendedActions }
   */
  async generateReport(kpis, emotions) {
    return pRetry(
      async () => {
        try {
          logger.info('Generating report with Gemini');

          const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

          const prompt = `以下はオンラインレッスンの分析結果です:

【発話比率】
- 講師発話比率: ${(kpis.talkRatioTutor * 100).toFixed(1)}%
- 生徒発話比率: ${((1 - kpis.talkRatioTutor) * 100).toFixed(1)}%

【講師の連続発話】
- 最長連続発話: ${Math.round(kpis.maxTutorMonologueMs / 1000)}秒
- 3分超モノローグ: ${kpis.monologueOver3MinCount}回
- 5分超モノローグ: ${kpis.monologueOver5MinCount}回

【生徒の参加度】
- 発話ターン数: ${kpis.studentTurns}回
- 15秒超の沈黙: ${kpis.studentSilenceOver15sCount}回

【割り込み】
- 講師→生徒: ${kpis.interruptionsTutorOverStudent}回
- 生徒→講師: ${kpis.interruptionsStudentOverTutor}回

【感情シグナル】
- 困惑推定: ${(emotions.confusionRatioEst * 100).toFixed(1)}%
- ストレス推定: ${(emotions.stressRatioEst * 100).toFixed(1)}%
- ポジティブ: ${(emotions.positiveRatioEst * 100).toFixed(1)}%

アラート: ${kpis.alerts || 'なし'}

この結果をもとに:
1. improvement_advice: 200〜500文字で改善アドバイスを生成してください
2. recommended_actions: 具体的な改善アクション3つ（各50文字以内）

JSON形式で回答してください:
{
  "improvement_advice": "...",
  "recommended_actions": ["アクション1", "アクション2", "アクション3"]
}`;

          const result = await model.generateContent(prompt);
          const text = result.response.text();

          // Parse JSON
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('Failed to parse report response');
          }

          const data = JSON.parse(jsonMatch[0]);

          logger.info('Report generation complete');

          return {
            improvementAdvice: data.improvement_advice || '',
            recommendedActions: (data.recommended_actions || []).join('\n'),
          };
        } catch (error) {
          logger.error('Report generation failed', error);
          return {
            improvementAdvice: 'レポート生成に失敗しました',
            recommendedActions: '',
          };
        }
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(
            `Report generation attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
          );
        },
      }
    );
  }

  /**
   * Format segments for sheet output
   * @param {Array} segments 
   * @returns {string}
   */
  formatSegments(segments) {
    if (!segments || segments.length === 0) return '';

    return segments.map((s) => `${s.timestamp}: ${s.reason}`).join('\n');
  }
}

export const geminiService = new GeminiService();
