import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { geminiService } from './geminiService.js';
import { audioService } from './audioService.js';
import axios from 'axios';
import { createReadStream } from 'fs';
import pRetry from 'p-retry';

class TranscriptionService {
  constructor() {
    this.assemblyaiApiKey = config.assemblyaiApiKey;
  }

  /**
   * Initialize transcription service
   */
  async initialize() {
    await geminiService.initialize();
    logger.info('Transcription service initialized (Gemini)');
  }

  /**
   * Perform speaker diarization using AssemblyAI
   * @param {string} audioPath 
   * @returns {Object} { utterances: [...] }
   */
  async diarizeWithAssemblyAI(audioPath) {
    return pRetry(
      async () => {
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
          let pollCount = 0;
          const maxPolls = 120; // 10 minutes max (5s interval)

          while (pollCount < maxPolls) {
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
            await new Promise((resolve) => setTimeout(resolve, 5000));
            pollCount++;
          }

          if (transcript.status !== 'completed') {
            throw new Error('AssemblyAI transcription timeout');
          }

          // Step 4: Extract utterances with speaker labels
          const utterances = transcript.utterances.map((utt) => ({
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
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(
            `AssemblyAI attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
          );
        },
      }
    );
  }

  /**
   * Transcribe and diarize using Gemini (includes both transcription and basic speaker detection)
   * Automatically splits long audio files into chunks
   * @param {string} audioPath 
   * @returns {Object} { utterances: [...] }
   */
  async transcribeAndDiarizeWithGemini(audioPath) {
    let chunks = [];
    
    try {
      logger.info('Using Gemini for transcription and speaker detection');

      // Split audio into chunks (12-minute chunks)
      chunks = await audioService.splitAudioIntoChunks(audioPath, 12);
      
      logger.info(`Audio split into ${chunks.length} chunks`);

      let segments;
      
      if (chunks.length === 1) {
        // Single chunk - use original method
        const result = await geminiService.transcribeAudioSingleFile(audioPath);
        segments = result.segments;
      } else {
        // Multiple chunks - use chunked transcription
        const result = await geminiService.transcribeAudioWithChunks(audioPath, chunks);
        segments = result.segments;
      }

      // Map Gemini speakers to roles
      // Assumption: Speaker A is Tutor
      const utterances = segments.map((seg) => ({
        start_ms: seg.start_ms,
        end_ms: seg.end_ms,
        speaker_role: seg.speaker === 'A' ? 'Tutor' : 'Student',
        text: seg.text,
      }));

      // Cleanup chunk files (except original)
      if (chunks.length > 1) {
        const chunkFilesToDelete = chunks.filter(c => c.path !== audioPath);
        await audioService.cleanupChunks(chunkFilesToDelete);
      }

      return { utterances };
    } catch (error) {
      logger.error('Gemini transcription and diarization failed', error);
      
      // Cleanup on error
      if (chunks.length > 1) {
        const chunkFilesToDelete = chunks.filter(c => c.path !== audioPath);
        await audioService.cleanupChunks(chunkFilesToDelete).catch(() => {});
      }
      
      throw error;
    }
  }

  /**
   * Main method: Transcribe and diarize audio
   * Priority: AssemblyAI (high quality) > Gemini (good quality)
   * @param {string} audioPath 
   * @returns {Object} { utterances: [...] }
   */
  async transcribeAndDiarize(audioPath) {
    try {
      // Try AssemblyAI first (best diarization quality)
      if (this.assemblyaiApiKey) {
        const result = await this.diarizeWithAssemblyAI(audioPath);

        // Map AssemblyAI speakers (A/B) to roles (Tutor/Student)
        const utterances = result.utterances.map((utt) => ({
          start_ms: utt.start_ms,
          end_ms: utt.end_ms,
          speaker_role: utt.speaker === 'A' ? 'Tutor' : 'Student',
          text: utt.text,
          confidence: utt.confidence,
        }));

        return { utterances };
      }

      // Fallback: Use Gemini
      logger.info('AssemblyAI not configured, using Gemini');
      return await this.transcribeAndDiarizeWithGemini(audioPath);
    } catch (error) {
      logger.error('Transcription and diarization failed', error);
      throw error;
    }
  }
}

export const transcriptionService = new TranscriptionService();
