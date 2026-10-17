/**
 * useVoiceGuidance Hook
 *
 * Provides reactive voice guidance state, playback controls, and lifecycle safety.
 *
 * Guarantees:
 * 1. Idempotency: Prevents duplicate audio triggers during React re-renders.
 * 2. Unmount cleanup: Stops speech and resets audio elements on unmount.
 * 3. User choice persistence: Remembers voice guidance toggle across sessions.
 * 4. Language responsiveness: Aligns automatically with LanguageContext.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { voiceGuidanceService, type VoiceEngineSource } from '@/services/voiceGuidanceService';
import type { TranslationKey, Language } from '@/i18n/translations';

const STORAGE_KEY = 'pulsebridge_voice_guidance_enabled';

export interface UseVoiceGuidanceReturn {
  isEnabled: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  activeSource: VoiceEngineSource;
  error: string | null;
  toggleEnabled: () => void;
  setEnabled: (enabled: boolean) => void;
  speakInstruction: (keyOrText: TranslationKey | string, langOverride?: Language) => Promise<void>;
  repeat: () => Promise<void>;
  stop: () => void;
}

export function useVoiceGuidance(initialAutoPromptKey?: TranslationKey): UseVoiceGuidanceReturn {
  const { lang, t } = useLanguage();

  const [isEnabled, setIsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<VoiceEngineSource>(null);
  const [error, setError] = useState<string | null>(null);

  // Track the most recent text to prevent duplicate speech on re-renders
  const lastSpokenRef = useRef<string | null>(null);
  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;

  const setEnabled = useCallback((val: boolean) => {
    setIsEnabledState(val);
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
    } catch {
      // Safe ignore
    }
    if (!val) {
      voiceGuidanceService.stop();
      setIsSpeaking(false);
      setIsLoading(false);
      setActiveSource(null);
    }
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled(!isEnabledRef.current);
  }, [setEnabled]);

  const stop = useCallback(() => {
    voiceGuidanceService.stop();
    setIsSpeaking(false);
    setIsLoading(false);
    setActiveSource(null);
  }, []);

  const speakInstruction = useCallback(
    async (keyOrText: TranslationKey | string, langOverride?: Language) => {
      if (!isEnabledRef.current) return;

      const currentLang = langOverride || lang;
      // Resolve translated text if key is a translation key, otherwise use raw string
      const resolvedText = t(keyOrText as TranslationKey) || keyOrText;

      // Avoid duplicate trigger if already speaking this exact text
      if (lastSpokenRef.current === `${currentLang}:${resolvedText}` && voiceGuidanceService.getIsSpeaking()) {
        return;
      }

      lastSpokenRef.current = `${currentLang}:${resolvedText}`;
      setIsLoading(true);
      setError(null);

      await voiceGuidanceService.speak(resolvedText, currentLang, {
        onStart: () => {
          setIsLoading(false);
          setIsSpeaking(true);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setActiveSource(null);
        },
        onError: (err) => {
          setIsLoading(false);
          setIsSpeaking(false);
          setError(err.message);
        },
        onSourceResolved: (src) => {
          setActiveSource(src);
        },
      });
    },
    [lang, t]
  );

  const repeat = useCallback(async () => {
    const lastSpoken = voiceGuidanceService.getLastSpokenText();
    const lastLang = voiceGuidanceService.getLastSpokenLang();

    if (!lastSpoken) return;

    setIsLoading(true);
    setError(null);

    await voiceGuidanceService.speak(lastSpoken, lastLang, {
      onStart: () => {
        setIsLoading(false);
        setIsSpeaking(true);
      },
      onEnd: () => {
        setIsSpeaking(false);
        setActiveSource(null);
      },
      onError: (err) => {
        setIsLoading(false);
        setIsSpeaking(false);
        setError(err.message);
      },
      onSourceResolved: (src) => {
        setActiveSource(src);
      },
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      voiceGuidanceService.stop();
    };
  }, []);

  // Optional auto-prompt on mount if enabled
  useEffect(() => {
    if (initialAutoPromptKey && isEnabled) {
      speakInstruction(initialAutoPromptKey);
    }
  }, [initialAutoPromptKey, isEnabled, speakInstruction]);

  return {
    isEnabled,
    isSpeaking,
    isLoading,
    activeSource,
    error,
    toggleEnabled,
    setEnabled,
    speakInstruction,
    repeat,
    stop,
  };
}
