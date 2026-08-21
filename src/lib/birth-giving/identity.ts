const WHITESPACE_PATTERN = /\s+/g;

export interface EventIdentityInput {
  eventName: string;
  customer: string;
  startsAt: Date;
}

export interface NormalizedEventIdentity {
  eventName: string;
  customer: string;
  startsAt: string;
}

export interface DuplicateCandidate extends EventIdentityInput {
  id: string;
}

export function normalizeEventIdentity(
  identity: EventIdentityInput,
): NormalizedEventIdentity {
  return {
    eventName: normalizeIdentityText(identity.eventName),
    customer: normalizeIdentityText(identity.customer),
    startsAt: identity.startsAt.toISOString(),
  };
}

export function rankDuplicateCandidates<T extends DuplicateCandidate>(
  identity: EventIdentityInput,
  candidates: readonly T[],
): T[] {
  const normalizedIdentity = normalizeEventIdentity(identity);
  const targetTime = identity.startsAt.getTime();

  return [...candidates].sort((left, right) => {
    const scoreDifference =
      duplicateTextScore(normalizedIdentity, right) -
      duplicateTextScore(normalizedIdentity, left);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const timeDifference =
      Math.abs(left.startsAt.getTime() - targetTime) -
      Math.abs(right.startsAt.getTime() - targetTime);

    if (timeDifference !== 0 || left.id === right.id) {
      return timeDifference;
    }

    return left.id < right.id ? -1 : 1;
  });
}

function normalizeIdentityText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(WHITESPACE_PATTERN, " ");
}

function duplicateTextScore(
  identity: NormalizedEventIdentity,
  candidate: DuplicateCandidate,
): number {
  return (
    textSimilarity(identity.eventName, normalizeIdentityText(candidate.eventName)) +
    textSimilarity(identity.customer, normalizeIdentityText(candidate.customer))
  );
}

function textSimilarity(left: string, right: string): number {
  const longestLength = Math.max(left.length, right.length);

  if (longestLength === 0) {
    return 1;
  }

  return 1 - levenshteinDistance(left, right) / longestLength;
}

function levenshteinDistance(left: string, right: string): number {
  let previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const currentRow = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      currentRow[rightIndex] = Math.min(
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex] + 1,
        previousRow[rightIndex - 1] + substitutionCost,
      );
    }

    previousRow = currentRow;
  }

  return previousRow[right.length];
}
