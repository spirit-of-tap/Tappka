import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

import { MAX_BIO_TEXT_LENGTH } from '@/lib/profile/bio-validation';

import { BioSection } from './bio-section';

const { refreshMock, VALID_EDIT, OVER_LIMIT_EDIT } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  VALID_EDIT: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Upravené bio o mně.' }] },
    ],
  },
  // 6000 chars — safely above MAX_BIO_TEXT_LENGTH (5000).
  OVER_LIMIT_EDIT: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(6000) }] }],
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Tiptap needs a real browser layout engine; driving keystrokes in jsdom is
// flaky. This stub exercises the BioSection save flow (draft state,
// validation, fetch, toasts, router.refresh) without the editor itself.
// Tiptap editing UX remains covered by bio-editor.test.tsx + manual QA.
vi.mock('./bio-editor', () => ({
  BioEditor: ({ onChange }: { onChange?: (json: object) => void }) => (
    <div data-testid="bio-editor-mock">
      <button type="button" onClick={() => onChange?.(VALID_EDIT)}>
        Simulate valid edit
      </button>
      <button type="button" onClick={() => onChange?.(OVER_LIMIT_EDIT)}>
        Simulate over-limit edit
      </button>
    </div>
  ),
}));

const BIO = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ahoj, jsem student:ka.' }] }],
};

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Upravit bio/i }));
  await screen.findByRole('dialog');
}

describe('BioSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders bio text for visitors without edit button', () => {
    render(<BioSection bioJson={BIO} isOwnProfile={false} />);
    expect(screen.getByText(/Ahoj, jsem/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upravit/i })).toBeNull();
  });

  it('shows empty state with edit button for own profile', () => {
    render(<BioSection bioJson={null} isOwnProfile={true} />);
    expect(screen.getByText(/Představte se ostatním/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upravit bio/i })).toBeInTheDocument();
  });

  it('opens dialog on Upravit click with char count and disabled Uložit', async () => {
    const user = userEvent.setup();
    render(<BioSection bioJson={BIO} isOwnProfile={true} />);

    await openDialog(user);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('bio-editor-mock')).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`/\\s*${MAX_BIO_TEXT_LENGTH}`)),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Uložit$/ })).toBeDisabled();
  });

  it('closes dialog on Zrušit', async () => {
    const user = userEvent.setup();
    render(<BioSection bioJson={BIO} isOwnProfile={true} />);

    await openDialog(user);
    await user.click(screen.getByRole('button', { name: /Zrušit/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('saves valid edit via PATCH, shows success toast and refreshes', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<BioSection bioJson={BIO} isOwnProfile={true} />);

    await openDialog(user);
    await user.click(screen.getByRole('button', { name: /Simulate valid edit/i }));

    const saveButton = screen.getByRole('button', { name: /^Uložit$/ });
    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
    await user.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/profile/bio');
    expect(options.method).toBe('PATCH');
    const body = JSON.parse(options.body as string) as { bio_json: unknown };
    expect(JSON.stringify(body.bio_json)).toContain('Upravené bio o mně.');
    expect(toast.success).toHaveBeenCalledWith('Bio bylo uloženo.');
    expect(refreshMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('shows validation error toast and skips fetch for over-limit content', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<BioSection bioJson={BIO} isOwnProfile={true} />);

    await openDialog(user);
    await user.click(screen.getByRole('button', { name: /Simulate over-limit edit/i }));

    const saveButton = screen.getByRole('button', { name: /^Uložit$/ });
    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
    await user.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/příliš dlouhé/));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    // Dialog stays open so the user can fix the content.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
