'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Team, ProfileRole } from '@/lib/komunita/types';
import { ROLE_LABELS, YEAR_LABELS } from '@/lib/komunita/types';

interface FilterBarProps {
  teams: Team[];
}

export function FilterBar({ teams }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentTeamId = searchParams.get('teamId');
  const currentRole = searchParams.get('role') as ProfileRole | null;
  const currentYear = searchParams.get('year');

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const hasActiveFilters = currentTeamId || currentRole || currentYear;

  const handleReset = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('teamId');
    params.delete('role');
    params.delete('year');
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Team Filter */}
      <Select value={currentTeamId || 'all'} onValueChange={(value) => updateFilter('teamId', value === 'all' ? null : value)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Všechny týmy" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všechny týmy</SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              <div className="flex items-center gap-2">
                {team.color && (
                  <div
                    className="size-2 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                )}
                {team.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Role Filter */}
      <Select value={currentRole || 'all'} onValueChange={(value) => updateFilter('role', value === 'all' ? null : value)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Všechny role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všechny role</SelectItem>
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <SelectItem key={role} value={role}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Year Filter */}
      <Select value={currentYear || 'all'} onValueChange={(value) => updateFilter('year', value === 'all' ? null : value)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Ročník" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všechny ročníky</SelectItem>
          {Object.entries(YEAR_LABELS).map(([year, label]) => (
            <SelectItem key={year} value={year}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reset Button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="size-4 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}
