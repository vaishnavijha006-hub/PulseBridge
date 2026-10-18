import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatientWorkflowDemoModal } from './PatientWorkflowDemoModal';
import { LanguageProvider } from '@/i18n/LanguageContext';

vi.mock('@/services/voiceGuidanceService', () => ({
  voiceGuidanceService: {
    speak: vi.fn(),
    stop: vi.fn(),
    getSource: vi.fn().mockReturnValue(null),
    getIsSpeaking: vi.fn().mockReturnValue(false),
  },
}));

describe('PatientWorkflowDemoModal', () => {
  const renderModal = (props: {
    isOpen: boolean;
    onClose?: () => void;
    onExploreDemoPatient?: () => void;
    onStartIntake?: () => void;
    lang?: 'en' | 'hi';
  }) => {
    return render(
      <LanguageProvider initialLang={props.lang || 'en'}>
        <PatientWorkflowDemoModal
          isOpen={props.isOpen}
          onClose={props.onClose || vi.fn()}
          onExploreDemoPatient={props.onExploreDemoPatient || vi.fn()}
          onStartIntake={props.onStartIntake || vi.fn()}
        />
      </LanguageProvider>
    );
  };

  it('does not render anything when isOpen is false', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when isOpen is true with initial Step 1', () => {
    renderModal({ isOpen: true, lang: 'en' });
    expect(screen.getByText(/Patient Workflow: How PulseBridge Works/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Step 1: Smart Intake/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Ravi Sharma/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows stepping forward and backward through the 6 recovery steps', () => {
    renderModal({ isOpen: true, lang: 'en' });

    // Click Next Step to reach Step 2 (Prescription Scan)
    const nextBtn = screen.getByRole('button', { name: /Next Step/i });
    fireEvent.click(nextBtn);

    expect(screen.getAllByText(/Step 2: Prescription Scan/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Aspirin \(Ecosprin\)/i)).toBeInTheDocument();

    // Click Previous to go back to Step 1
    const prevBtn = screen.getByRole('button', { name: /Previous/i });
    fireEvent.click(prevBtn);

    expect(screen.getAllByText(/Step 1: Smart Intake/i).length).toBeGreaterThanOrEqual(1);
  });

  it('calls onExploreDemoPatient when Open Live Demo Patient is clicked', () => {
    const mockExplore = vi.fn();
    const mockClose = vi.fn();
    renderModal({ isOpen: true, onExploreDemoPatient: mockExplore, onClose: mockClose });

    const openBtn = screen.getByRole('button', { name: /Open Live Demo Patient \(Ravi Sharma\)/i });
    fireEvent.click(openBtn);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockExplore).toHaveBeenCalledTimes(1);
  });

  it('renders Hindi language text when Hindi is active', () => {
    renderModal({ isOpen: true, lang: 'hi' });
    expect(screen.getByText(/मरीज़ वर्कफ़्लो: वेबसाइट कैसे काम करती है\?/i)).toBeInTheDocument();
    expect(screen.getAllByText(/चरण 1: स्मार्ट पंजीकरण/i).length).toBeGreaterThanOrEqual(1);
  });
});
