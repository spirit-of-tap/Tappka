import type {
  RocketCategoryWithItems,
  RocketIndividualState,
  RocketTeamCheck,
} from "@/lib/rocket-model/types";
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types";

export interface TeamProgressStats {
  totalItems: number;
  teamCheckedCount: number;
  teamCheckedPercent: number;
  readyToConfirmCount: number;
  reconfirmationCount: number;
  inProgressCount: number;
}

export interface RocketSectionRadarPoint {
  categoryId: string;
  code: string;
  title: string;
  orderIndex: number;
  totalItems: number;
  teamCheckedCount: number;
  teamCheckedPercent: number;
  unanimousCount: number;
  unanimousPercent: number;
  memberAveragePercent: number;
  totalMemberChecks: number;
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

export function calculateRocketRadarData(
  categories: RocketCategoryWithItems[],
  teamMembers: TeamMemberProfile[],
  states: RocketIndividualState[],
  teamChecks: RocketTeamCheck[],
): RocketSectionRadarPoint[] {
  const teamChecksByItem = new Map(
    teamChecks.map((check) => [check.item_id, check]),
  );

  const memberIdSet = new Set(teamMembers.map((m) => m.id));
  const checkedByItem = new Map<string, Set<string>>();
  for (const state of states) {
    if (!state.is_checked) continue;
    if (memberIdSet.size > 0 && !memberIdSet.has(state.profile_id)) continue;
    const memberSet = checkedByItem.get(state.item_id) ?? new Set<string>();
    memberSet.add(state.profile_id);
    checkedByItem.set(state.item_id, memberSet);
  }

  const memberCount = teamMembers.length;
  const sortedCategories = [...categories].sort(
    (a, b) => a.order_index - b.order_index,
  );

  return sortedCategories.map((category) => {
    const totalItems = category.items.length;
    let teamCheckedCount = 0;
    let unanimousCount = 0;
    let totalMemberChecks = 0;

    for (const item of category.items) {
      if (teamChecksByItem.get(item.id)?.is_checked) {
        teamCheckedCount += 1;
      }

      const checkers = checkedByItem.get(item.id);
      const checkersCount = checkers?.size ?? 0;
      totalMemberChecks += checkersCount;

      if (isUnanimous(checkersCount, memberCount)) {
        unanimousCount += 1;
      }
    }

    const maxPossibleChecks = totalItems * memberCount;
    const memberAveragePercent =
      maxPossibleChecks > 0
        ? coveragePercent(totalMemberChecks, maxPossibleChecks)
        : 0;

    return {
      categoryId: category.id,
      code: category.code,
      title: category.title,
      orderIndex: category.order_index,
      totalItems,
      teamCheckedCount,
      teamCheckedPercent: coveragePercent(teamCheckedCount, totalItems),
      unanimousCount,
      unanimousPercent: coveragePercent(unanimousCount, totalItems),
      memberAveragePercent,
      totalMemberChecks,
    };
  });
}
