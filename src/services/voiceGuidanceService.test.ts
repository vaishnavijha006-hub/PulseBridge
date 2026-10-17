import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceGuidanceService } from './voiceGuidanceService';
import * as supabaseModule from '@/lib/supabase';

describe('VoiceGuidanceService', () => {
  let service: VoiceGuidanceService;
  let mockAudioPause: any;
  let mockSpeechSynthesisSpeak: any;
  let mockSpeechSynthesisCancel: any;

  beforeEach(() => {
    service = new VoiceGuidanceService();

    mockAudioPause = vi.fn();

    // Mock HTMLAudioElement
    vi.stubGlobal('Audio', vi.fn().mockImplementation(() => {
      const audioInstance: any = {
        pause: mockAudioPause,
        currentTime: 0,
        onplay: null,
        onended: null,
        onerror: null,
      };
      audioInstance.play = vi.fn().mockImplementation(() => {
        if (audioInstance.onplay) audioInstance.onplay();
        if (audioInstance.onended) audioInstance.onended();
        return Promise.resolve();
      });
      return audioInstance;
    }));

    // Mock URL.createObjectURL and URL.revokeObjectURL
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-audio-url-123'),
      revokeObjectURL: vi.fn(),
    });

    // Mock Web Speech API
    mockSpeechSynthesisSpeak = vi.fn().mockImplementation((utterance: any) => {
      if (utterance?.onstart) utterance.onstart();
      if (utterance?.onend) utterance.onend();
    });
    mockSpeechSynthesisCancel = vi.fn();

    vi.stubGlobal('speechSynthesis', {
      speak: mockSpeechSynthesisSpeak,
      cancel: mockSpeechSynthesisCancel,
      getVoices: vi.fn().mockReturnValue([
        { lang: 'en-US', name: 'Google US English' },
        { lang: 'hi-IN', name: 'Google Hindi' },
      ]),
    });

    vi.stubGlobal('SpeechSynthesisUtterance', vi.fn().mockImplementation((text) => ({
      text,
      lang: '',
      rate: 1,
      pitch: 1,
      onstart: null,
      onend: null,
      onerror: null,
    })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to Web Speech API when Supabase is not configured', async () => {
    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(null as any);

    const onSourceResolved = vi.fn();
    await service.speak('Hello patient', 'en', { onSourceResolved });

    expect(onSourceResolved).toHaveBeenCalledWith('webspeech');
    expect(mockSpeechSynthesisSpeak).toHaveBeenCalled();
  });

  it('selects Hindi locale when language is hi in Web Speech fallback', async () => {
    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(null as any);

    await service.speak('नमस्ते', 'hi');

    expect(mockSpeechSynthesisSpeak).toHaveBeenCalled();
    expect(service.getLastSpokenLang()).toBe('hi');
    expect(service.getLastSpokenText()).toBe('नमस्ते');
  });

  it('invokes Supabase Edge Function when Supabase client is configured', async () => {
    const mockBlob = new Blob(['audio-content'], { type: 'audio/mpeg' });
    const mockInvoke = vi.fn().mockResolvedValue({ data: mockBlob, error: null });

    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue({
      functions: {
        invoke: mockInvoke,
      },
    } as any);

    const onSourceResolved = vi.fn();
    await service.speak('Please upload your prescription', 'en', { onSourceResolved });

    expect(mockInvoke).toHaveBeenCalledWith('elevenlabs-tts', {
      body: {
        text: 'Please upload your prescription',
        lang: 'en',
        voiceId: undefined,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(onSourceResolved).toHaveBeenCalledWith('elevenlabs');
  });

  it('falls back to Web Speech if Edge Function invocation returns an error', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'TTS_NOT_CONFIGURED' },
    });

    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue({
      functions: {
        invoke: mockInvoke,
      },
    } as any);

    const onSourceResolved = vi.fn();
    await service.speak('Instructions', 'en', { onSourceResolved });

    expect(mockInvoke).toHaveBeenCalled();
    expect(onSourceResolved).toHaveBeenCalledWith('webspeech');
    expect(mockSpeechSynthesisSpeak).toHaveBeenCalled();
  });

  it('caches generated audio to avoid duplicate network invocations', async () => {
    const mockBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
    const mockInvoke = vi.fn().mockResolvedValue({ data: mockBlob, error: null });

    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue({
      functions: {
        invoke: mockInvoke,
      },
    } as any);

    // First call
    await service.speak('Check details', 'en');
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    // Second call with identical text and lang
    await service.speak('Check details', 'en');
    // Should NOT call Edge Function again due to cache hit
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('stops active audio and cancels speech synthesis on stop()', async () => {
    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(null as any);

    await service.speak('Speaking', 'en');
    service.stop();

    expect(mockSpeechSynthesisCancel).toHaveBeenCalled();
    expect(service.getIsSpeaking()).toBe(false);
    expect(service.getSource()).toBe(null);
  });

  it('repeats the last instruction with repeat()', async () => {
    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(null as any);

    await service.speak('Initial instruction', 'hi');
    expect(service.getLastSpokenText()).toBe('Initial instruction');

    await service.repeat();
    expect(mockSpeechSynthesisSpeak).toHaveBeenCalledTimes(2);
  });

  it('revokes cached Object URLs on clearCache()', async () => {
    const mockBlob = new Blob(['test'], { type: 'audio/mpeg' });
    const mockRevoke = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:test-url'),
      revokeObjectURL: mockRevoke,
    });

    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue({
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: mockBlob, error: null }),
      },
    } as any);

    await service.speak('Cache test', 'en');
    service.clearCache();
    expect(mockRevoke).toHaveBeenCalledWith('blob:test-url');
  });
});
