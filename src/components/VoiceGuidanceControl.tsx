import React from 'react';
import { Volume2, VolumeX, RotateCcw, Square, Loader2, Sparkles } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import type { UseVoiceGuidanceReturn } from '@/hooks/useVoiceGuidance';
import { cn } from '@/utils/cn';

interface VoiceGuidanceControlProps {
  voice: UseVoiceGuidanceReturn;
  className?: string;
  variant?: 'compact' | 'full';
}

export const VoiceGuidanceControl: React.FC<VoiceGuidanceControlProps> = ({
  voice,
  className,
  variant = 'full',
}) => {
  const { t } = useLanguage();
  const {
    isEnabled,
    isSpeaking,
    isLoading,
    activeSource,
    error,
    toggleEnabled,
    repeat,
    stop,
  } = voice;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border transition-all',
        isEnabled
          ? 'bg-teal-50/60 border-teal-200 text-teal-900 shadow-sm'
          : 'bg-white/80 border-surface-border text-navy-600',
        variant === 'compact' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        className
      )}
      role="region"
      aria-label={t('voice_guidance_title')}
    >
      {/* Toggle Enable/Mute Button */}
      <button
        type="button"
        onClick={toggleEnabled}
        className={cn(
          'flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1',
          isEnabled
            ? 'text-teal-700 hover:text-teal-900'
            : 'text-navy-500 hover:text-navy-800'
        )}
        title={isEnabled ? t('voice_disable') : t('voice_enable')}
        aria-label={isEnabled ? t('voice_disable') : t('voice_enable')}
        aria-pressed={isEnabled}
      >
        {isEnabled ? (
          <Volume2 className={cn('text-teal-600', variant === 'compact' ? 'w-4 h-4' : 'w-4 h-4')} />
        ) : (
          <VolumeX className={cn('text-navy-400', variant === 'compact' ? 'w-4 h-4' : 'w-4 h-4')} />
        )}
        <span className="font-semibold select-none">
          {isEnabled ? t('voice_guidance_title') : t('voice_enable')}
        </span>
      </button>

      {/* When enabled, show controls and indicators */}
      {isEnabled && (
        <div className="flex items-center gap-1.5 border-l border-teal-200/80 pl-2">
          {/* Active Speaking / Loading Indicator */}
          {isLoading ? (
            <div className="flex items-center gap-1 text-teal-600 text-xs px-1.5 py-0.5 rounded">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">{t('voice_loading')}</span>
            </div>
          ) : isSpeaking ? (
            <div className="flex items-center gap-1.5 text-teal-700 text-xs font-medium px-2 py-0.5 bg-teal-100/70 rounded-md">
              <span className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 h-2 bg-teal-600 rounded motion-safe:animate-pulse" />
                <span className="w-0.5 h-3 bg-teal-600 rounded motion-safe:animate-pulse delay-75" />
                <span className="w-0.5 h-1.5 bg-teal-600 rounded motion-safe:animate-pulse delay-150" />
              </span>
              <span className="hidden sm:inline">{t('voice_speaking')}</span>
            </div>
          ) : null}

          {/* Source Badge (ElevenLabs or Standard) */}
          {activeSource === 'elevenlabs' && (
            <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-100 text-teal-800 text-[10px] font-bold rounded tracking-wide uppercase">
              <Sparkles className="w-2.5 h-2.5 text-teal-600" />
              {t('voice_elevenlabs_badge')}
            </span>
          )}

          {/* Repeat Button */}
          <button
            type="button"
            onClick={() => repeat()}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-teal-700 hover:bg-teal-100/80 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            title={t('voice_repeat')}
            aria-label={t('voice_repeat')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('voice_repeat')}</span>
          </button>

          {/* Stop Button (visible while speaking) */}
          {isSpeaking && (
            <button
              type="button"
              onClick={stop}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
              title={t('voice_stop')}
              aria-label={t('voice_stop')}
            >
              <Square className="w-3 h-3 fill-rose-600 text-rose-600" />
              <span className="hidden sm:inline">{t('voice_stop')}</span>
            </button>
          )}

          {/* Error Message if any */}
          {error && (
            <span className="text-[11px] text-amber-700 italic hidden lg:inline" role="alert">
              ({t('voice_error')})
            </span>
          )}
        </div>
      )}
    </div>
  );
};
