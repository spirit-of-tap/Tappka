import { TS_GUEST_ERROR_CODES, TS_GUEST_ERROR_MESSAGES } from "./constants"

const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_NOT_FOUND = 404
const HTTP_CONFLICT = 409

export interface TsRpcErrorMapping {
  error: string
  status: number
  code?: string
}

/** Maps a training-session RPC exception message to an HTTP response shape, or null when unknown. */
export function mapTsRpcError(message: string | undefined): TsRpcErrorMapping | null {
  if (message === "not_authenticated") return { error: "Neautorizováno", status: HTTP_UNAUTHORIZED }
  if (message === "forbidden") return { error: "TS patří jinému týmu", status: HTTP_FORBIDDEN }
  const code = TS_GUEST_ERROR_CODES.find((candidate) => candidate === message)
  if (!code) return null
  return {
    error: TS_GUEST_ERROR_MESSAGES[code],
    status: code === "not_found" ? HTTP_NOT_FOUND : HTTP_CONFLICT,
    code,
  }
}
