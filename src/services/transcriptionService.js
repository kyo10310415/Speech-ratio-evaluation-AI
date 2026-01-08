import OpenAI from 'openai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createReadStream } from 'fs';
import axios from 'axios';

class TranscriptionService {
  constructor() {
    this.openai = null;
    this.assemblyaiApiKey = config.assemblyaiApiKey;
  }

  /**
   * Initialize transcription service
   */
  async initialize() {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
    logger.info('Transcription service initialized');
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   * @param {string} audioPath 
   * @returns {Object} { segments: [...] }
   */
  async transcribeWithWhisper(audioPath) {
    try {
      logger.info(`Transcribing audio with Whisper: ${audioPath}`);

      const transcription = await this.openai.audio.transcriptions.create({
        file: createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      // Convert segments to milliseconds
      const segments = transcription.segments.map(seg => ({
        start_ms: Math.round(seg.start * 1000),
        end_ms: Math.round(seg.end * 1000),
        text: seg.text.trim(),
      }));

      logger.info(`Transcription complete: ${segments.length} segments`);

      return { segments };
    } catch (error) {
      logger.error('Whisper transcription failed', error);
      throw error;
    }
  }

  /**
   * Perform speaker diarization using AssemblyAI
   * @param {string} audioPath 
   * @returns {Object} { utterances: [...] }
   */
  async diarizeWithAssemblyAI(audioPath) {
    try {
      if (!this.assemblyaiApiKey) {
        throw new Error('AssemblyAI API key not configured');
      }

      logger.info(`Starting diarization with AssemblyAI: ${audioPath}`);

      // Step 1: Upload audio file
      const uploadResponse = await axios.post(
        'https://api.assemblyai.com/v2/upload',
        createReadStream(audioPath),
        {
          headers: {
            authorization: this.assemblyaiApiKey,
            'content-type': 'application/octet-stream',
          },
        }
      );

      const uploadUrl = uploadResponse.data.upload_url;
      logger.info(`Audio uploaded to AssemblyAI: ${uploadUrl}`);

      // Step 2: Request transcription with speaker diarization
      const transcriptResponse = await axios.post(
        'https://api.assemblyai.com/v2/transcript',
        {
          audio_url: uploadUrl,
          speaker_labels: true,
          speakers_expected: 2, // Tutor + Student
        },
        {
          headers: {
            authorization: this.assemblyaiApiKey,
            'content-type': 'application/json',
          },
        }
      );

      const transcriptId = transcriptResponse.data.id;
      logger.info(`Transcription job created: ${transcriptId}`);

      // Step 3: Poll for completion
      let transcript = null;
      while (true) {
        const pollingResponse = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          {
            headers: {
              authorization: this.assemblyaiApiKey,
            },
          }
        );

        transcript = pollingResponse.data;

        if (transcript.status === 'completed') {
          break;
        } else if (transcript.status === 'error') {
          throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
        }

        // Wait 5 seconds before polling again
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Step 4: Extract utterances with speaker labels
      const utterances = transcript.utterances.map(utt => ({
        start_ms: utt.start,
        end_ms: utt.end,
        speaker: utt.speaker, // "A" or "B"
        text: utt.text.trim(),
        confidence: utt.confidence,
      }));

      logger.info(`Diarization complete: ${utterances.length} utterances`);

      return { utterances };
    } catch (error) {
      logger.error('AssemblyAI diarization failed', error);
      throw error;
    }
  }

  /**
   * Fallback: Simple rule-based speaker assignment (for MVP without AssemblyAI)
   * Assigns first speaker as Tutor, second as Student
   * @param {Array} segments - Whisper segments
   * @returns {Object} { utterances: [...] }
   */
  simpleDiarization(segments) {
    logger.warn('Using simple diarization fallback (assumes alternating speakers)');

    // Simple heuristic: assign speakers based on alternating pattern
    // In reality, this is very limited but can work as MVP
    let currentSpeaker = 'Tutor';
    let lastEndTime = 0;
    const SILENCE_THRESHOLD = 2000; // 2 seconds

    const utterances = segments.map(seg => {
      // If there's a long silence, assume speaker change
      if (seg.start_ms - lastEndTime > SILENCE_THRESHOLD) {
        currentSpeaker = currentSpeaker === 'Tutor' ? 'Student' : 'Tutor';
      }

      lastEndTime = seg.end_ms;

      return {
        start_ms: seg.start_ms,
        end_ms: seg.end_ms,
        speaker_role: currentSpeaker,
        text: seg.text,
      };
    });

    return { utterances };
  }

  /**
   * Main method: Transcribe and diarize audio
   * @param {string} audioPath 
   * @returns {Object} { utterances: [...] }
   */
  async transcribeAndDiarize(audioPath) {
    try {
      // Try AssemblyAI first (includes both transcription and diarization)
      if (this.assemblyaiApiKey) {
        const result = await this.diarizeWithAssemblyAI(audioPath);
        
        // Map AssemblyAI speakers (A/B) to roles (Tutor/Student)
        // Assumption: Speaker A is Tutor
        const utterances = result.utterances.map(utt => ({
          start_ms: utt.start_ms,
          end_ms: utt.end_ms,
          speaker_role: utt.speaker === 'A' ? 'Tutor' : 'Student',
          text: utt.text,
          confidence: utt.confidence,
        }));

        return { utterances };
      }

      // Fallback: Whisper transcription + simple diarization
      logger.warn('AssemblyAI not configured, using Whisper + simple diarization');
      const { segments } = await this.transcribeWithWhisper(audioPath);
      return this.simpleDiarization(segments);

    } catch (error) {
      logger.error('Transcription and diarization failed', error);
      throw error;
    }
  }
}

export const transcriptionService = new TranscriptionService();
