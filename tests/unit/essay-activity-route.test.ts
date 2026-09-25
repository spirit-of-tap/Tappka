import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentUserProfile: vi.fn(),
  getEssayViewers: vi.fn(),
  getEssayVoters: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/auth-helpers', () => ({
  getCurrentUserProfile: mocks.getCurrentUserProfile,
}));

vi.mock('@/lib/essays/queries', () => ({
  getEssayViewers: mocks.getEssayViewers,
  getEssayVoters: mocks.getEssayVoters,
}));

import { GET } from '@/app/api/essays/[id]/activity/route';

describe('GET /api/essays/[id]/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const essayId = 'essay-123';
  const authorProfileId = 'author-456';
  const viewerProfileId = 'viewer-789';

  function mockSupabase(essayData: { id: string; author_profile_id: string } | null = { id: essayId, author_profile_id: authorProfileId }) {
    return {
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: 'auth-user-id' } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: essayData, error: null }),
          }),
        }),
      }),
    };
  }

  it('returns 401 if unauthenticated', async () => {
    mocks.createClient.mockResolvedValueOnce({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null } }),
      },
    });

    const req = new NextRequest('http://localhost:3000/api/essays/essay-123/activity');
    const res = await GET(req, { params: Promise.resolve({ id: essayId }) });

    expect(res.status).toBe(401);
  });

  it('returns 404 if essay does not exist', async () => {
    mocks.createClient.mockResolvedValueOnce(mockSupabase(null));
    mocks.getCurrentUserProfile.mockResolvedValueOnce({ id: authorProfileId });

    const req = new NextRequest('http://localhost:3000/api/essays/essay-123/activity');
    const res = await GET(req, { params: Promise.resolve({ id: essayId }) });

    expect(res.status).toBe(404);
  });

  it('returns both views and votes for the author', async () => {
    const fakeClient = mockSupabase();
    mocks.createClient.mockResolvedValueOnce(fakeClient);
    mocks.getCurrentUserProfile.mockResolvedValueOnce({ id: authorProfileId });

    const mockViews = [
      {
        viewer_profile_id: viewerProfileId,
        first_viewed_at: '2026-09-20T10:00:00Z',
        last_viewed_at: '2026-09-24T12:00:00Z',
        viewer: { id: viewerProfileId, name: 'Reader One', picture: null, role: 'student', team: null },
      },
    ];

    const mockVotes = [
      {
        voter_profile_id: viewerProfileId,
        created_at: '2026-09-23T15:00:00Z',
        voter: { id: viewerProfileId, name: 'Reader One', picture: null, role: 'student', team: null },
      },
    ];

    mocks.getEssayViewers.mockResolvedValueOnce(mockViews);
    mocks.getEssayVoters.mockResolvedValueOnce(mockVotes);

    const req = new NextRequest('http://localhost:3000/api/essays/essay-123/activity');
    const res = await GET(req, { params: Promise.resolve({ id: essayId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAuthor).toBe(true);
    expect(body.views).toEqual(mockViews);
    expect(body.votes).toEqual(mockVotes);
    expect(mocks.getEssayViewers).toHaveBeenCalledWith(fakeClient, essayId);
    expect(mocks.getEssayVoters).toHaveBeenCalledWith(fakeClient, essayId);
  });

  it('does not fetch views for non-author', async () => {
    const fakeClient = mockSupabase();
    mocks.createClient.mockResolvedValueOnce(fakeClient);
    mocks.getCurrentUserProfile.mockResolvedValueOnce({ id: 'someone-else' });

    const mockVotes = [
      {
        voter_profile_id: viewerProfileId,
        created_at: '2026-09-23T15:00:00Z',
        voter: { id: viewerProfileId, name: 'Reader One', picture: null, role: 'student', team: null },
      },
    ];

    mocks.getEssayVoters.mockResolvedValueOnce(mockVotes);

    const req = new NextRequest('http://localhost:3000/api/essays/essay-123/activity');
    const res = await GET(req, { params: Promise.resolve({ id: essayId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAuthor).toBe(false);
    expect(body.views).toEqual([]);
    expect(body.votes).toEqual(mockVotes);
    expect(mocks.getEssayViewers).not.toHaveBeenCalled();
    expect(mocks.getEssayVoters).toHaveBeenCalledWith(fakeClient, essayId);
  });
});
