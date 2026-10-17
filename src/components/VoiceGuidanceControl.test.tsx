import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceGuidanceControl } from './VoiceGuidanceControl';
import { LanguageProvider } from '@/i18n/LanguageContext';
import type { UseVoiceGuidanceReturn } from '@/hooks/useVoiceGuidance';

describe('VoiceGuidanceControl', () => {
  const createMockVoice = (overrides?: Partial<UseVoiceGuidanceReturn>): UseVoiceGuidanceReturn => ({
    isEnabled: false,
    isSpeaking: false,
    isLoading: false,
    activeSource: null,
    error: null,
    toggleEnabled: vi.fn(),
    setEnabled: vi.fn(),
    speakInstruction: vi.fn(),
    repeat: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  });

  const renderWithLang = (ui: React.ReactElement, lang: 'en' | 'hi' = 'en') => {
    return render(
      <LanguageProvider initialLang={lang}>
        {ui}
      </LanguageProvider>
    );
  };

  it('renders muted/disabled state initially with proper accessibility attributes', () => {
    const mockVoice = createMockVoice({ isEnabled: false });

    renderWithLang(<VoiceGuidanceControl voice={mockVoice} />, 'en');

    const button = screen.getByRole('button', { name: /Turn on voice guidance/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls toggleEnabled when user clicks the toggle button', () => {
    const mockVoice = createMockVoice({ isEnabled: false });

    renderWithLang(<VoiceGuidanceControl voice={mockVoice} />, 'en');

    const button = screen.getByRole('button', { name: /Turn on voice guidance/i });
    fireEvent.click(button);

    expect(mockVoice.toggleEnabled).toHaveBeenCalledTimes(1);
  });

  it('displays repeat and source controls when voice guidance is enabled', () => {
    const mockVoice = createMockVoice({
      isEnabled: true,
      activeSource: 'elevenlabs',
    });

    renderWithLang(<VoiceGuidanceControl voice={mockVoice} />, 'en');

    expect(screen.getByTitle(/Repeat instruction/i)).toBeInTheDocument();
    expect(screen.getByText(/ElevenLabs AI/i)).toBeInTheDocument();
  });

  it('calls repeat when repeat button is clicked', () => {
    const mockVoice = createMockVoice({ isEnabled: true });

    renderWithLang(<VoiceGuidanceControl voice={mockVoice} />, 'en');

    const repeatBtn = screen.getByTitle(/Repeat instruction/i);
    fireEvent.click(repeatBtn);

    expect(mockVoice.repeat).toHaveBeenCalledTimes(1);
  });

  it('shows stop button when speaking and calls stop on click', () => {
    const mockVoice = createMockVoice({
      isEnabled: true,
      isSpeaking: true,
    });

    renderWithLang(<VoiceGuidanceControl voice={mockVoice} />, 'en');

    const stopBtn = screen.getByTitle(/Stop speaking/i);
    expect(stopBtn).toBeInTheDocument();

    fireEvent.click(stopBtn);
    expect(mockVoice.stop).toHaveBeenCalledTimes(1);
  });

  it('shows loading state indicator when audio is preparing', () => {
    const mockVoice = createMockVoice({
      isEnabled: true,
      isLoading: true,
    });

    renderWithLang(<VoiceGuidanceControl voice={mockVoice} />, 'en');

    expect(screen.getByText(/Preparing audio.../i)).toBeInTheDocument();
  });

  it('renders Hindi labels accurately when language context is Hindi', () => {
    const mockVoice = createMockVoice({ isEnabled: false });

    renderWithLang(<VoiceGuidanceControl voice={mockVoice} />, 'hi');

    expect(screen.getByRole('button', { name: /आवाज़ मार्गदर्शन चालू करें/i })).toBeInTheDocument();
  });
});
