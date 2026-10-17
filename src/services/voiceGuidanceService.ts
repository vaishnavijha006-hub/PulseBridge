/**
 * Voice Guidance Service for PulseBridge AI
 *
 * Integrates ElevenLabs text-to-speech for accessible Hindi and English
 * patient guidance, with a graceful client-side Web Speech API fallback.
 *
 * Security & Reliability Guarantees:
 * 1. ElevenLabs API calls are proxied through the Supabase Edge Function
 *    `elevenlabs-tts`. Secrets are NEVER exposed to or stored on the client.
 * 2. When the backend or ElevenLabs is unreachable or unconfigured, the service
 *    falls back to the browser's native `speechSynthesis`.
 * 3. In-memory object URL caching avoids redundant audio generation.
 * 4. Object URLs are cleaned up to prevent memory leaks.
 */

import { supabase } from '@/lib/supabase';
import type { Language } from '@/i18n/translations';

export type VoiceEngineSource = 'elevenlabs' | 'webspeech' | null;

export interface VoicePlaybackCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  onSourceResolved?: (source: VoiceEngineSource) => void;
}

export interface VoiceGuidanceOptions extends VoicePlaybackCallbacks {
  voiceId?: string;
}

export class VoiceGuidanceService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentBlobUrl: string | null = null;
  private activeSource: VoiceEngineSource = null;
  private isSpeaking = false;
  private audioCache = new Map<string, string>(); // key: `${lang}:${text}` -> blobUrl
  private abortController: AbortController | null = null;
  private lastSpokenText: string | null = null;
  private lastSpokenLang: Language = 'en';

  /**
   * Generates a cache key based on language and text.
   */
  private getCacheKey(text: string, lang: Language): string {
    return `${lang}:${text.trim()}`;
  }

  /**
   * Gets the active engine source ('elevenlabs' or 'webspeech').
   */
  public getSource(): VoiceEngineSource {
    return this.activeSource;
  }

  /**
   * Checks whether speech is currently in progress.
   */
  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Returns the last spoken text.
   */
  public getLastSpokenText(): string | null {
    return this.lastSpokenText;
  }

  /**
   * Returns the last spoken language.
   */
  public getLastSpokenLang(): Language {
    return this.lastSpokenLang;
  }

  /**
   * Stops all active speech, cancels WebSpeech, and resets audio elements.
   */
  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.onplay = null;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Safe ignore
      }
    }

    this.isSpeaking = false;
    this.activeSource = null;
  }

  /**
   * Speaks the given text in the requested language.
   * Attempts ElevenLabs via Supabase Edge Function first, then falls back to Web Speech.
   */
  public async speak(
    text: string,
    lang: Language = 'en',
    options?: VoiceGuidanceOptions
  ): Promise<void> {
    const cleanText = text.trim();
    if (!cleanText) return;

    // Stop any existing speech
    this.stop();

    this.lastSpokenText = cleanText;
    this.lastSpokenLang = lang;

    const cacheKey = this.getCacheKey(cleanText, lang);

    // 1. Check in-memory audio cache
    const cachedUrl = this.audioCache.get(cacheKey);
    if (cachedUrl) {
      try {
        await this.playAudioUrl(cachedUrl, 'elevenlabs', options);
        return;
      } catch {
        // If cached playback fails, remove from cache and proceed
        this.audioCache.delete(cacheKey);
      }
    }

    // 2. Attempt ElevenLabs via Edge Function
    this.abortController = new AbortController();
    try {
      const audioBlob = await this.fetchElevenLabsAudio(cleanText, lang, options?.voiceId, this.abortController.signal);
      if (audioBlob) {
        const blobUrl = URL.createObjectURL(audioBlob);
        this.audioCache.set(cacheKey, blobUrl);
        await this.playAudioUrl(blobUrl, 'elevenlabs', options);
        return;
      }
    } catch {
      // Upstream/network error or unconfigured; gracefully fallback to Web Speech
    }

    // 3. Graceful Fallback to Web Speech API
    await this.speakWithWebSpeech(cleanText, lang, options);
  }

  /**
   * Repeats the most recently spoken instruction.
   */
  public async repeat(options?: VoiceGuidanceOptions): Promise<void> {
    if (!this.lastSpokenText) return;
    await this.speak(this.lastSpokenText, this.lastSpokenLang, options);
  }

  /**
   * Calls the Supabase Edge Function proxy for ElevenLabs text-to-speech.
   */
  private async fetchElevenLabsAudio(
    text: string,
    lang: Language,
    voiceId?: string,
    signal?: AbortSignal
  ): Promise<Blob | null> {
    if (!supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: { text, lang, voiceId },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error || !data) {
        return null;
      }

      // If data is a Blob
      if (data instanceof Blob) {
        return data;
      }

      // If data is ArrayBuffer or ArrayBuffer-like
      if (data instanceof ArrayBuffer) {
        return new Blob([data], { type: 'audio/mpeg' });
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Plays an audio stream from an Object URL with lifecycle callbacks.
   */
  private playAudioUrl(
    url: string,
    source: VoiceEngineSource,
    callbacks?: VoicePlaybackCallbacks
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio(url);
        this.currentAudio = audio;
        this.currentBlobUrl = url;
        this.activeSource = source;
        this.isSpeaking = true;

        callbacks?.onSourceResolved?.(source);

        audio.onplay = () => {
          callbacks?.onStart?.();
        };

        audio.onended = () => {
          this.isSpeaking = false;
          this.activeSource = null;
          callbacks?.onEnd?.();
          resolve();
        };

        audio.onerror = () => {
          this.isSpeaking = false;
          this.activeSource = null;
          const err = new Error('HTMLAudioElement playback error.');
          callbacks?.onError?.(err);
          reject(err);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            this.isSpeaking = false;
            this.activeSource = null;
            callbacks?.onError?.(err);
            reject(err);
          });
        }
      } catch (err) {
        this.isSpeaking = false;
        this.activeSource = null;
        callbacks?.onError?.(err instanceof Error ? err : new Error(String(err)));
        reject(err);
      }
    });
  }

  /**
   * Fallback using browser native SpeechSynthesis API.
   */
  private speakWithWebSpeech(
    text: string,
    lang: Language,
    callbacks?: VoicePlaybackCallbacks
  ): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        const err = new Error('SpeechSynthesis not supported on this device.');
        callbacks?.onError?.(err);
        resolve();
        return;
      }

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        // Try to match a native language voice if available
        const voices = window.speechSynthesis.getVoices();
        const targetLocale = lang === 'hi' ? 'hi' : 'en';
        const matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLocale));
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }

        this.activeSource = 'webspeech';
        callbacks?.onSourceResolved?.('webspeech');

        utterance.onstart = () => {
          this.isSpeaking = true;
          callbacks?.onStart?.();
        };

        utterance.onend = () => {
          this.isSpeaking = false;
          this.activeSource = null;
          callbacks?.onEnd?.();
          resolve();
        };

        utterance.onerror = (e) => {
          this.isSpeaking = false;
          this.activeSource = null;
          // Filter out user cancellation
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            callbacks?.onError?.(new Error(`WebSpeech error: ${e.error}`));
          }
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        this.isSpeaking = false;
        this.activeSource = null;
        callbacks?.onError?.(err instanceof Error ? err : new Error(String(err)));
        resolve();
      }
    });
  }

  /**
   * Cleans up all cached blob URLs and resets state.
   */
  public clearCache(): void {
    for (const url of this.audioCache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Safe ignore
      }
    }
    this.audioCache.clear();
  }
}

// Export singleton instance
export const voiceGuidanceService = new VoiceGuidanceService();
