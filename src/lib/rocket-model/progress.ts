import type { TeamMemberProfile } from "@/lib/tymovy-denik/types";

export interface TeamProgressStats {
  totalItems: number;
  teamCheckedCount: number;
  teamCheckedPercent: number;
  readyToConfirmCount: number;
  reconfirmationCount: number;
  inProgressCount: number;
}

export function coveragePercent(checkedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return Math.round((checkedCount / totalCount) * 100);
}

export function isUnanimous(checkedCount: number, memberCount: number): boolean {
  return memberCount > 0 && checkedCount === memberCount;
}

export function canCheckAsTeam(checkedCount: number, memberCount: number): boolean {
  return isUnanimous(checkedCount, memberCount);
}

export function needsReconfirmation(teamChecked: boolean, unanimousNow: boolean): boolean {
  return teamChecked && !unanimousNow;
}

export function calculateTeamProgressStats(
  itemIds: string[],
  teamChecksByItem: Map<string, { is_checked?: boolean }>,
  checkedByItem: Map<string, Set<string>>,
  memberCount: number,
): TeamProgressStats {
  const totalItems = itemIds.length;
  let teamCheckedCount = 0;
  let readyToConfirmCount = 0;
  let reconfirmationCount = 0;
  let inProgressCount = 0;

  for (const itemId of itemIds) {
    const checkedCount = checkedByItem.get(itemId)?.size ?? 0;
    const unanimous = isUnanimous(checkedCount, memberCount);
    const teamCheck = teamChecksByItem.get(itemId);
    const teamChecked = teamCheck?.is_checked ?? false;

    if (teamChecked) {
      teamCheckedCount += 1;
    }

    if (needsReconfirmation(teamChecked, unanimous)) {
      reconfirmationCount += 1;
    } else if (unanimous && !teamChecked) {
      readyToConfirmCount += 1;
    } else if (!teamChecked && !unanimous) {
      inProgressCount += 1;
    }
  }

  return {
    totalItems,
    teamCheckedCount,
    teamCheckedPercent: coveragePercent(teamCheckedCount, totalItems),
    readyToConfirmCount,
    reconfirmationCount,
    inProgressCount,
  };
}

export function getMissingMembers(
  allMembers: TeamMemberProfile[],
  checkedMemberIds: Set<string>,
): TeamMemberProfile[] {
  return allMembers.filter((member) => !checkedMemberIds.has(member.id));
}



