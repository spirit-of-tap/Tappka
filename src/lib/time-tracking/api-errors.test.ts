import { describe, expect, it } from "vitest"

import { isDbErrorLike, mapDbError } from "./api-errors"

describe("mapDbError", () => {
  it("maps exclusion violations to an overlap conflict", () => {
    expect(
      mapDbError({
        code: "23P01",
        message: 'conflicting key value violates exclusion constraint "time_entries_no_overlap"',
      }),
    ).toEqual({ status: 409, message: "Záznam se překrývá s jiným záznamem" })
  })

  it("maps the one-running-timer unique index", () => {
    expect(
      mapDbError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "time_entries_one_running_key"',
      }),
    ).toEqual({ status: 409, message: "Už ti běží časomíra" })
  })

  it("maps the tag name unique index", () => {
    expect(
      mapDbError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "time_tags_profile_name_key"',
        details: "Key (profile_id, lower(btrim(name)))=(…) already exists.",
      }),
    ).toEqual({ status: 409, message: "Tag s tímto názvem už máš" })
  })

  it("maps other unique violations to a generic conflict", () => {
    expect(mapDbError({ code: "23505", message: "duplicate key value violates unique constraint \"x\"" }).status).toBe(
      409,
    )
  })

  it("maps check violations to an invalid range", () => {
    expect(
      mapDbError({ code: "23514", message: 'new row violates check constraint "time_entries_end_after_start"' }),
    ).toEqual({ status: 400, message: "Neplatný časový rozsah" })
  })

  it("maps FK, RLS and no-rows errors", () => {
    expect(mapDbError({ code: "23503" }).status).toBe(400)
    expect(mapDbError({ code: "42501" }).status).toBe(403)
    expect(mapDbError({ code: "PGRST116" }).status).toBe(404)
  })

  it("falls back to 500", () => {
    expect(mapDbError({ code: "XX000", message: "boom" }).status).toBe(500)
    expect(mapDbError(null).status).toBe(500)
    expect(mapDbError(undefined).status).toBe(500)
  })
})

describe("isDbErrorLike", () => {
  it("recognises objects with a string code", () => {
    expect(isDbErrorLike({ code: "23505", message: "x" })).toBe(true)
    expect(isDbErrorLike(new Error("x"))).toBe(false)
    expect(isDbErrorLike(null)).toBe(false)
    expect(isDbErrorLike({ code: 5 })).toBe(false)
  })
})
