import { z } from "zod";

const MAX_EVENT_NAME_LENGTH = 160;
const MAX_CUSTOMER_LENGTH = 160;
const MAX_TEAM_NAME_LENGTH = 120;
const MAX_REFLECTION_LENGTH = 5_000;
const MINIMUM_TEAM_SIZE = 1;
const MAXIMUM_TEAM_SIZE = 100;

const trimmedText = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength);

const distinctUuidArray = z
  .array(z.uuid())
  .min(1)
  .max(MAXIMUM_TEAM_SIZE)
  .refine((values) => new Set(values).size === values.length, {
    message: "Identifikátory se nesmí opakovat",
  });

const birthGivingEventFieldsSchema = z
  .object({
    name: trimmedText(MAX_EVENT_NAME_LENGTH),
    customer: trimmedText(MAX_CUSTOMER_LENGTH),
    startsAt: z.iso.datetime({ offset: true }),
    duration: z.enum(["8h", "24h"]),
    minimumTeamSize: z.number().int().min(MINIMUM_TEAM_SIZE).max(MAXIMUM_TEAM_SIZE),
    maximumTeamSize: z.number().int().min(MINIMUM_TEAM_SIZE).max(MAXIMUM_TEAM_SIZE),
    joiningOpen: z.boolean(),
    organizerProfileIds: distinctUuidArray,
  })
  .strict();

export const birthGivingDraftSchema = birthGivingEventFieldsSchema
  .refine(({ minimumTeamSize, maximumTeamSize }) => maximumTeamSize >= minimumTeamSize, {
    message: "Maximální velikost týmu musí být alespoň minimální velikost",
    path: ["maximumTeamSize"],
  });

export const birthGivingEventPatchSchema = birthGivingEventFieldsSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Je nutné zadat alespoň jednu změnu",
  })
  .refine(
    ({ minimumTeamSize, maximumTeamSize }) =>
      minimumTeamSize === undefined
      || maximumTeamSize === undefined
      || maximumTeamSize >= minimumTeamSize,
    {
      message: "Maximální velikost týmu musí být alespoň minimální velikost",
      path: ["maximumTeamSize"],
    },
  );

export const birthGivingJoiningSchema = z.object({ joiningOpen: z.boolean() }).strict();

export const birthGivingLookingForTeamSchema = z.object({ looking: z.boolean() }).strict();

export const birthGivingTeamSchema = z
  .object({ name: trimmedText(MAX_TEAM_NAME_LENGTH) })
  .strict();

export const birthGivingProposalSchema = z
  .object({
    teamId: z.uuid(),
    candidateProfileId: z.uuid(),
    direction: z.enum(["join_request", "invitation"]),
    acknowledgeMove: z.boolean(),
  })
  .strict();

export const birthGivingHistoricalTeamSchema = z
  .object({
    name: trimmedText(MAX_TEAM_NAME_LENGTH),
    memberProfileIds: distinctUuidArray,
    resultState: z.enum(["present", "missing"]),
  })
  .strict();

export const birthGivingReflectionSchema = z
  .object({
    contribution: trimmedText(MAX_REFLECTION_LENGTH),
    learning: trimmedText(MAX_REFLECTION_LENGTH),
  })
  .strict();

export interface BirthGivingPostgresError {
  code?: string;
  message: string;
}

export const BIRTH_GIVING_ERROR_CODES = {
  formationClosed: "FORMATION_CLOSED",
  teamFull: "TEAM_FULL",
  proposalResolved: "PROPOSAL_RESOLVED",
  alreadyJoined: "ALREADY_JOINED",
  assignmentNotReleased: "ASSIGNMENT_NOT_RELEASED",
  assignmentLocked: "ASSIGNMENT_LOCKED",
  duplicateEvent: "DUPLICATE_EVENT",
  publicationInvalid: "PUBLICATION_INVALID",
  moveRequiresAcknowledgement: "MOVE_REQUIRES_ACKNOWLEDGEMENT",
  invalidRelation: "INVALID_RELATION",
  validationError: "VALIDATION_ERROR",
} as const;

export interface BirthGivingApiError {
  code: (typeof BIRTH_GIVING_ERROR_CODES)[keyof typeof BIRTH_GIVING_ERROR_CODES];
  message: string;
  status: 409 | 422;
}

const ERROR_RULES: ReadonlyArray<{
  patterns: readonly string[];
  error: BirthGivingApiError;
}> = [
  {
    patterns: ["move_requires_acknowledgement"],
    error: {
      code: BIRTH_GIVING_ERROR_CODES.moveRequiresAcknowledgement,
      message: "Přesun z existujícího týmu vyžaduje výslovné potvrzení.",
      status: 409,
    },
  },
  {
    patterns: [
      "target team does not belong",
      "does not belong to the event",
      "reflection requires confirmed participation",
    ],
    error: {
      code: BIRTH_GIVING_ERROR_CODES.invalidRelation,
      message: "Požadovaná vazba není pro tuto událost platná.",
      status: 409,
    },
  },
  {
    patterns: [
      "team formation is closed",
      "joining can only change before the event start",
    ],
    error: {
      code: BIRTH_GIVING_ERROR_CODES.formationClosed,
      message: "Sestavování týmů už není otevřené.",
      status: 409,
    },
  },
  {
    patterns: ["maximum capacity"],
    error: {
      code: BIRTH_GIVING_ERROR_CODES.teamFull,
      message: "Tým už dosáhl maximální kapacity.",
      status: 409,
    },
  },
  {
    patterns: ["proposal is missing or already resolved"],
    error: {
      code: BIRTH_GIVING_ERROR_CODES.proposalResolved,
      message: "Návrh už byl vyřešen nebo neexistuje.",
      status: 409,
    },
  },
  {
    patterns: [
      "already belongs to a team",
      "confirmed members cannot look for a team",
      "birth_giving_team_members_event_profile_key",
    ],
    error: {
      code: BIRTH_GIVING_ERROR_CODES.alreadyJoined,
      message: "Pro tuto událost už existuje členství v týmu.",
      status: 409,
    },
  },
  {
    patterns: ["assignment is not released", "assignment has not been released"],
    error: {
      code: BIRTH_GIVING_ERROR_CODES.assignmentNotReleased,
      message: "Zadání zatím není zveřejněné.",
      status: 409,
    },
  },
  {
    patterns: ["assignment is locked", "assignment replacement is locked"],
    error: {
      code: BIRTH_GIVING_ERROR_CODES.assignmentLocked,
      message: "Zadání už nelze změnit.",
      status: 409,
    },
  },
  {
    patterns: ["birth_giving_events_identity_key"],
    error: {
      code: BIRTH_GIVING_ERROR_CODES.duplicateEvent,
      message: "Stejná Birth Giving událost už existuje.",
      status: 409,
    },
  },
  {
    patterns: [
      "retrospective event requires",
      "every retrospective team",
      "at least one organizer is required",
      "team result state must agree",
      "only an active draft can be published",
      "historical team size is outside event capacity",
    ],
    error: {
      code: BIRTH_GIVING_ERROR_CODES.publicationInvalid,
      message: "Událost nesplňuje podmínky pro zveřejnění.",
      status: 422,
    },
  },
];

export function mapBirthGivingPostgresError(
  error: BirthGivingPostgresError,
): BirthGivingApiError | null {
  if (error.code === "22023") {
    return {
      code: BIRTH_GIVING_ERROR_CODES.validationError,
      message: "Zadané údaje nejsou platné.",
      status: 422,
    };
  }
  const message = error.message.toLowerCase();
  return ERROR_RULES.find(({ patterns }) => patterns.some((pattern) => message.includes(pattern)))
    ?.error ?? null;
}
