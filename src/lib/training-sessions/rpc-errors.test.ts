import { describe, expect, it } from "vitest"

import { mapTsRpcError } from "./rpc-errors"

describe("mapTsRpcError", () => {
  it("maps not_found to 404", () => {
    expect(mapTsRpcError("not_found")).toMatchObject({ status: 404, code: "not_found" })
  })
  it("maps guest conflicts to 409", () => {
    expect(mapTsRpcError("capacity_full")).toMatchObject({ status: 409, code: "capacity_full" })
    expect(mapTsRpcError("own_team")).toMatchObject({ status: 409, code: "own_team" })
  })
  it("maps auth errors without a code", () => {
    expect(mapTsRpcError("not_authenticated")).toEqual({ error: "Neautorizováno", status: 401 })
    expect(mapTsRpcError("forbidden")).toEqual({ error: "TS patří jinému týmu", status: 403 })
  })
  it("returns null for unknown messages", () => {
    expect(mapTsRpcError("boom")).toBeNull()
    expect(mapTsRpcError(undefined)).toBeNull()
  })
})
