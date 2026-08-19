import { BIRTH_GIVING_DURATION_HOURS } from "./constants";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export function calculateEventEnd(
  startsAt: Date,
  duration: keyof typeof BIRTH_GIVING_DURATION_HOURS,
): Date {
  return new Date(
    startsAt.getTime() +
      BIRTH_GIVING_DURATION_HOURS[duration] * MILLISECONDS_PER_HOUR,
  );
}

export function getEventTimeState(
  startsAt: Date,
  duration: keyof typeof BIRTH_GIVING_DURATION_HOURS,
  now: Date,
) {
  if (now.getTime() < startsAt.getTime()) {
    return "upcoming";
  }

  if (now.getTime() >= calculateEventEnd(startsAt, duration).getTime()) {
    return "ended";
  }

  return "active";
}

export function isAssignmentReleased(startsAt: Date, now: Date): boolean {
  return now.getTime() >= startsAt.getTime();
}
