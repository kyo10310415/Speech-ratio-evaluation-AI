import { logger } from '../utils/logger.js';
import { geminiService } from '../services/geminiService.js';

class EmotionAnalyzer {
  constructor() {
    // Uses geminiService
  }

  /**
   * Initialize emotion analyzer
   */
  async initialize() {
    await geminiService.initialize();
    logger.info('Emotion analyzer initialized (Gemini)');
  }

  /**
   * Analyze emotional signals in utterances
   * @param {Array} utterances 
   * @returns {Object} { confusion, stress, positive }
   */
  async analyzeEmotionalSignals(utterances) {
    return await geminiService.analyzeEmotions(utterances);
  }

  /**
   * Generate improvement advice and recommendations
   * @param {Object} kpis 
   * @param {Object} emotions 
   * @returns {Object} { improvementAdvice, recommendedActions }
   */
  async generateReport(kpis, emotions) {
    return await geminiService.generateReport(kpis, emotions);
  }
}

export const emotionAnalyzer = new EmotionAnalyzer();
