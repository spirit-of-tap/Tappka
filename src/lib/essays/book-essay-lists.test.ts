import { describe, expect, it } from "vitest";

import {
  mergeBookEssayMaps,
  toBookEssayPreview,
  type BookEssayPreview,
} from "./book-essay-lists";
import type { EssayWithDetails } from "./types";

function mockEssay(overrides: Partial<EssayWithDetails> = {}): EssayWithDetails {
  return {
    id: "essay-1",
    author_profile_id: "p1",
    book_id: "b-1",
    frozen_book_points: null,
    content_source_id: null,
    title: "Skvělá reflexe",
    content_json: {},
    content_text: "Text eseje",
    published_at: "2026-08-20T10:00:00Z",
    view_count: 0,
    vote_count: 0,
    created_at: "2026-08-20T10:00:00Z",
    updated_at: "2026-08-20T10:00:00Z",
    pinned_at: null,
    pinned_by_profile_id: null,
    removed_at: null,
    author: { id: "p1", name: "Petr Novák", picture: null, role: "student", team_id: "t1" },
    book: null,
    content_source: null,
    comment_count: 0,
    ...overrides,
  };
}

const previewA: BookEssayPreview = {
  id: "essay-a",
  title: "Esej A",
  author: { id: "p1", name: "Petr", picture: null, team_id: "t1" },
};

const previewB: BookEssayPreview = {
  id: "essay-b",
  title: "Esej B",
  author: { id: "p2", name: "Jana", picture: "pic.png", team_id: null },
};

describe("toBookEssayPreview", () => {
  it("maps id, title and author details for the book card", () => {
    expect(toBookEssayPreview(mockEssay())).toEqual({
      id: "essay-1",
      title: "Skvělá reflexe",
      author: { id: "p1", name: "Petr Novák", picture: null, team_id: "t1" },
    });
  });

  it("keeps author null when the essay has no author", () => {
    expect(toBookEssayPreview(mockEssay({ author: null })).author).toBeNull();
  });
});

describe("mergeBookEssayMaps", () => {
  it("fills books missing from the pool with fallback essays", () => {
    const merged = mergeBookEssayMaps({ "b-1": [previewA] }, { "b-2": [previewB] });

    expect(merged).toEqual({ "b-1": [previewA], "b-2": [previewB] });
  });

  it("never overwrites pool essays with fallback essays", () => {
    const fallbackForSameBook: BookEssayPreview = {
      id: "essay-old",
      title: "Stará esej",
      author: null,
    };

    const merged = mergeBookEssayMaps({ "b-1": [previewA] }, { "b-1": [fallbackForSameBook] });

    expect(merged["b-1"]).toEqual([previewA]);
  });

  it("does not mutate the input maps", () => {
    const pool = { "b-1": [previewA] };
    const fallback = { "b-2": [previewB] };

    mergeBookEssayMaps(pool, fallback);

    expect(pool).toEqual({ "b-1": [previewA] });
    expect(fallback).toEqual({ "b-2": [previewB] });
  });
});
