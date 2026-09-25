import { DB_CONSTRAINTS, TIME_TRACKING_MESSAGES } from "./constants"

/** Subset of `PostgrestError` we rely on. */
export interface DbErrorLike {
  code?: string | null
  message?: string | null
  details?: string | null
}

export interface MappedDbError {
  status: number
  message: string
}

export const PG_ERROR_CODES = {
  uniqueViolation: "23505",
  exclusionViolation: "23P01",
  checkViolation: "23514",
  foreignKeyViolation: "23503",
  insufficientPrivilege: "42501",
  /** PostgREST: `.single()` matched zero rows. */
  noRows: "PGRST116",
} as const

export const HTTP_STATUS = {
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  internalError: 500,
} as const

function mentions(error: DbErrorLike, constraint: string): boolean {
  return `${error.message ?? ""} ${error.details ?? ""}`.includes(constraint)
}

/** Maps a Postgres / PostgREST error to an HTTP status and a Czech user-facing message. */
export function mapDbError(error: DbErrorLike | null | undefined): MappedDbError {
  switch (error?.code) {
    case PG_ERROR_CODES.exclusionViolation:
      return { status: HTTP_STATUS.conflict, message: TIME_TRACKING_MESSAGES.overlap }
    case PG_ERROR_CODES.uniqueViolation:
      if (mentions(error, DB_CONSTRAINTS.oneRunningTimer)) {
        return { status: HTTP_STATUS.conflict, message: TIME_TRACKING_MESSAGES.timerAlreadyRunning }
      }
      if (mentions(error, DB_CONSTRAINTS.tagProfileName)) {
        return { status: HTTP_STATUS.conflict, message: TIME_TRACKING_MESSAGES.tagNameTaken }
      }
      return { status: HTTP_STATUS.conflict, message: TIME_TRACKING_MESSAGES.generic }
    case PG_ERROR_CODES.checkViolation:
      return { status: HTTP_STATUS.badRequest, message: TIME_TRACKING_MESSAGES.invalidRange }
    case PG_ERROR_CODES.foreignKeyViolation:
      return { status: HTTP_STATUS.badRequest, message: TIME_TRACKING_MESSAGES.invalidTag }
    case PG_ERROR_CODES.insufficientPrivilege:
      return { status: HTTP_STATUS.forbidden, message: TIME_TRACKING_MESSAGES.forbidden }
    case PG_ERROR_CODES.noRows:
      return { status: HTTP_STATUS.notFound, message: TIME_TRACKING_MESSAGES.entryNotFound }
    default:
      return { status: HTTP_STATUS.internalError, message: TIME_TRACKING_MESSAGES.generic }
  }
}

/** Narrows an unknown thrown value to something `mapDbError` understands. */
export function isDbErrorLike(value: unknown): value is DbErrorLike {
  return typeof value === "object" && value !== null && "code" in value && typeof value.code === "string"
}
