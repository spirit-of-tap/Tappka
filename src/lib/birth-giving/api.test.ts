import { describe, expect, it } from "vitest";

import {
  BIRTH_GIVING_ERROR_CODES,
  birthGivingEventCreateSchema,
  birthGivingEventPatchSchema,
  birthGivingReflectionSchema,
  birthGivingResultFileAddSchema,
  birthGivingTeamCreateSchema,
  birthGivingTeamUpdateSchema,
  mapBirthGivingPostgresError,
  type BirthGivingPostgresError,
} from "./api";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROFILE_ID = "22222222-2222-4222-8222-222222222222";

describe("Birth Giving API payload schemas", () => {
  it("parses and trims event create payload", () => {
    expect(
      birthGivingEventCreateSchema.parse({
        name: "  BG pro knihovnu  ",
        customer: "  Městská knihovna  ",
        startsAt: "2026-09-01T08:00:00.000Z",
        duration: "8h",
        organizerProfileIds: [PROFILE_ID, OTHER_PROFILE_ID],
      }),
    ).toEqual({
      name: "BG pro knihovnu",
      customer: "Městská knihovna",
      startsAt: "2026-09-01T08:00:00.000Z",
      duration: "8h",
      organizerProfileIds: [PROFILE_ID, OTHER_PROFILE_ID],
    });
  });

  it("accepts event patches", () => {
    expect(birthGivingEventPatchSchema.parse({ name: "  Nový název  " })).toEqual({
      name: "Nový název",
    });
    expect(birthGivingEventPatchSchema.parse({ duration: "24h" })).toEqual({
      duration: "24h",
    });
    expect(birthGivingEventPatchSchema.safeParse({}).success).toBe(true);
  });

  it("rejects status in an event create payload", () => {
    expect(
      birthGivingEventCreateSchema.safeParse({
        name: "BG pro knihovnu",
        customer: "Městská knihovna",
        startsAt: "2026-09-01T08:00:00.000Z",
        duration: "8h",
        organizerProfileIds: [PROFILE_ID],
        status: "published",
      }).success,
    ).toBe(false);
  });

  it("rejects assignment metadata in an event create payload", () => {
    expect(
      birthGivingEventCreateSchema.safeParse({
        name: "BG pro knihovnu",
        customer: "Městská knihovna",
        startsAt: "2026-09-01T08:00:00.000Z",
        duration: "8h",
        organizerProfileIds: [PROFILE_ID],
        assignmentState: "present",
      }).success,
    ).toBe(false);
  });

  it("rejects status and assignment metadata in event patch payloads", () => {
    expect(birthGivingEventPatchSchema.safeParse({ status: "published" }).success).toBe(false);
    expect(birthGivingEventPatchSchema.safeParse({ assignmentState: "present" }).success).toBe(
      false,
    );
  });

  it("accepts a solo team with an empty member list", () => {
    expect(
      birthGivingTeamCreateSchema.parse({
        name: "  Tým Aurora  ",
        memberProfileIds: [],
      }),
    ).toEqual({
      name: "Tým Aurora",
      memberProfileIds: [],
    });
    expect(birthGivingTeamUpdateSchema.parse({ memberProfileIds: [] })).toEqual({
      memberProfileIds: [],
    });
  });

  it("parses team create payload with members", () => {
    expect(
      birthGivingTeamCreateSchema.parse({
        name: "  Tým Aurora  ",
        memberProfileIds: [PROFILE_ID],
      }),
    ).toEqual({
      name: "Tým Aurora",
      memberProfileIds: [PROFILE_ID],
    });
  });

  it("parses team update payload", () => {
    expect(
      birthGivingTeamUpdateSchema.parse({
        isWinner: true,
      }),
    ).toEqual({
      isWinner: true,
    });
  });

  it("parses reflection payload", () => {
    expect(
      birthGivingReflectionSchema.parse({
        contribution: "  Kódování  ",
        learning: "  Testování  ",
      }),
    ).toEqual({
      contribution: "Kódování",
      learning: "Testování",
    });
  });

  it("parses result file add payload", () => {
    expect(
      birthGivingResultFileAddSchema.parse({
        storagePath: "path/to/file.pdf",
        originalFileName: "file.pdf",
        mimeType: "application/pdf",
        fileSize: 1024,
      }),
    ).toEqual({
      storagePath: "path/to/file.pdf",
      originalFileName: "file.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    });
  });
});

function postgresError(code: string): BirthGivingPostgresError {
  return {
    code,
    message: `test message for ${code}`,
    details: "some details",
    hint: "some hint",
  };
}

describe("mapBirthGivingPostgresError", () => {
  it("maps SQLSTATE 42501 to an unauthorized 403", () => {
    expect(mapBirthGivingPostgresError(postgresError("42501"))).toEqual({
      code: BIRTH_GIVING_ERROR_CODES.unauthorized,
      message: "K provedení této akce nemáte oprávnění.",
      status: 403,
    });
  });

  it("maps SQLSTATE P0002 to a not-found 404", () => {
    expect(mapBirthGivingPostgresError(postgresError("P0002"))).toEqual({
      code: BIRTH_GIVING_ERROR_CODES.notFound,
      message: "Požadovaná událost nebo tým neexistují.",
      status: 404,
    });
  });

  it("maps SQLSTATE 23505 to a duplicate 409", () => {
    expect(mapBirthGivingPostgresError(postgresError("23505"))).toEqual({
      code: BIRTH_GIVING_ERROR_CODES.duplicateEvent,
      message: "Stejná Birth Giving událost už existuje.",
      status: 409,
    });
  });

  it("maps SQLSTATE 23503 to an invalid-relation 409", () => {
    expect(mapBirthGivingPostgresError(postgresError("23503"))).toEqual({
      code: BIRTH_GIVING_ERROR_CODES.invalidRelation,
      message: "Požadovaná vazba není pro tuto událost platná.",
      status: 409,
    });
  });

  it("maps SQLSTATE 23514 to an invalid-state 409", () => {
    expect(mapBirthGivingPostgresError(postgresError("23514"))).toEqual({
      code: BIRTH_GIVING_ERROR_CODES.invalidState,
      message: "Požadovaná akce není v aktuálním stavu události možná.",
      status: 409,
    });
  });

  it("returns null for unmapped SQLSTATEs", () => {
    expect(mapBirthGivingPostgresError(postgresError("42P01"))).toBeNull();
  });
});
