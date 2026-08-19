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

export type BirthGivingTimeState = "upcoming" | "active" | "ended";

export function getEventTimeState(
  startsAt: Date,
  duration: keyof typeof BIRTH_GIVING_DURATION_HOURS,
  now: Date,
): BirthGivingTimeState {
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

const MINUTE_MILLISECONDS = 60 * 1000;

export function formatBirthGivingCountdown(remainingMilliseconds: number): string {
  if (remainingMilliseconds <= 0) return "0 min";
  const totalMinutes = Math.max(1, Math.round(remainingMilliseconds / MINUTE_MILLISECONDS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
