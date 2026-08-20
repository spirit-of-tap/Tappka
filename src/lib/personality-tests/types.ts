import type { Tables } from "@/lib/supabase/tables"

export type PersonalityTest = Tables<"personality_tests">

export const PERSONALITY_TEST_TYPES = [
  "gallup",
  "mbti",
  "disc",
  "big_five",
  "enneagram",
  "belbin",
  "other",
] as const

export type PersonalityTestType = (typeof PERSONALITY_TEST_TYPES)[number]

export const PERSONALITY_TEST_TYPE_LABELS: Record<PersonalityTestType, string> = {
  gallup: "Gallup",
  mbti: "MBTI",
  disc: "DISC",
  big_five: "Big Five",
  enneagram: "Enneagram",
  belbin: "Belbin",
  other: "Jiný test",
}

export function getTestTypeLabel(
  test: Pick<PersonalityTest, "test_type" | "test_type_other">,
): string {
  return test.test_type === "other"
    ? test.test_type_other ?? PERSONALITY_TEST_TYPE_LABELS.other
    : PERSONALITY_TEST_TYPE_LABELS[test.test_type]
}
