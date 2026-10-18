import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrescriptionUpload } from './PrescriptionUpload';
import { LanguageProvider } from '@/i18n/LanguageContext';

describe('PrescriptionUpload', () => {
  const renderComponent = (onUpload = vi.fn(), lang: 'en' | 'hi' = 'en') => {
    return render(
      <LanguageProvider initialLang={lang}>
        <PrescriptionUpload onUpload={onUpload} />
      </LanguageProvider>
    );
  };

  it('renders upload options initially without any error banner', () => {
    renderComponent();
    expect(screen.getByText('Select Photo')).toBeInTheDocument();
    expect(screen.getByText('Take Photo')).toBeInTheDocument();
    expect(screen.queryByText(/Photo saaf nahi aayi/i)).toBeNull();
    expect(screen.queryByText(/Photo was not clear/i)).toBeNull();
  });

  it('displays image preview upon valid image selection and clears error on remove', () => {
    const mockUpload = vi.fn();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-image');

    const { container } = renderComponent(mockUpload);

    const file = new File(['dummy-content'], 'prescription.jpg', { type: 'image/jpeg' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByAltText('Selected photo preview')).toBeInTheDocument();
    expect(mockUpload).toHaveBeenCalledWith(file, 'blob:http://localhost/test-image');

    // Click remove button (X)
    const removeBtn = screen.getByRole('button', { name: /Remove photo/i });
    fireEvent.click(removeBtn);

    // Verify preview is removed and NO blur error is shown
    expect(screen.queryByAltText('Selected photo preview')).toBeNull();
    expect(screen.queryByText(/Photo was not clear/i)).toBeNull();
    expect(screen.queryByText(/Photo saaf nahi aayi/i)).toBeNull();
    expect(screen.getByText('Select Photo')).toBeInTheDocument();
    expect(mockUpload).toHaveBeenCalledWith(null, null);
  });

  it('shows error for file exceeding 10MB and allows dismissing error', () => {
    const { container } = renderComponent();

    // 11MB file
    const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(screen.getByText(/Photo size is too large/i)).toBeInTheDocument();

    // Click dismiss button
    const dismissBtn = screen.getByRole('button', { name: /Dismiss notice/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/Photo size is too large/i)).toBeNull();
  });
});
