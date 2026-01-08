import OpenAI from 'openai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { formatTimestamp } from '../utils/dateUtils.js';

class EmotionAnalyzer {
  constructor() {
    this.openai = null;
  }

  /**
   * Initialize emotion analyzer
   */
  async initialize() {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
    logger.info('Emotion analyzer initialized');
  }

  /**
   * Analyze emotional signals in utterances
   * @param {Array} utterances 
   * @returns {Object} { confusion, stress, positive }
   */
  async analyzeEmotionalSignals(utterances) {
    try {
      logger.info('Analyzing emotional signals');

      // Prepare transcript with timestamps
      const transcript = utterances.map(u => 
        `[${formatTimestamp(u.start_ms)}] ${u.speaker_role}: ${u.text}`
      ).join('\n');

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

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたは教育コーチングの専門家です。レッスンの文字起こしから生徒の感情状態を分析します。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content);

      // Calculate ratios (simple heuristic based on segment count)
      const totalSegments = utterances.length;
      const confusionRatio = Math.min((result.confusion_segments?.length || 0) / 10, 1);
      const stressRatio = Math.min((result.stress_segments?.length || 0) / 10, 1);
      const positiveRatio = Math.min((result.positive_segments?.length || 0) / 10, 1);

      logger.info('Emotional signal analysis complete');

      return {
        confusionRatioEst: parseFloat(confusionRatio.toFixed(3)),
        stressRatioEst: parseFloat(stressRatio.toFixed(3)),
        positiveRatioEst: parseFloat(positiveRatio.toFixed(3)),
        confusionTop3: this.formatSegments(result.confusion_segments?.slice(0, 3) || []),
        stressTop3: this.formatSegments(result.stress_segments?.slice(0, 3) || []),
        positiveTop3: this.formatSegments(result.positive_segments?.slice(0, 3) || []),
      };
    } catch (error) {
      logger.error('Emotional signal analysis failed', error);
      // Return default values on error
      return {
        confusionRatioEst: 0,
        stressRatioEst: 0,
        positiveRatioEst: 0,
        confusionTop3: '',
        stressTop3: '',
        positiveTop3: '',
      };
    }
  }

  /**
   * Format segments for sheet output
   * @param {Array} segments 
   * @returns {string}
   */
  formatSegments(segments) {
    if (!segments || segments.length === 0) return '';
    
    return segments.map(s => 
      `${s.timestamp}: ${s.reason}`
    ).join('\n');
  }

  /**
   * Generate improvement advice and recommendations
   * @param {Object} kpis 
   * @param {Object} emotions 
   * @returns {Object} { improvementAdvice, recommendedActions }
   */
  async generateReport(kpis, emotions) {
    try {
      logger.info('Generating improvement report');

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

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたは教育コーチングの専門家です。レッスンの改善点を具体的にアドバイスします。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const result = JSON.parse(response.choices[0].message.content);

      logger.info('Report generation complete');

      return {
        improvementAdvice: result.improvement_advice || '',
        recommendedActions: (result.recommended_actions || []).join('\n'),
      };
    } catch (error) {
      logger.error('Report generation failed', error);
      // Return default values on error
      return {
        improvementAdvice: 'レポート生成に失敗しました',
        recommendedActions: '',
      };
    }
  }
}

export const emotionAnalyzer = new EmotionAnalyzer();
