"use client";

import { useState, useTransition } from "react";
import { setUnitBusinessHoursDay } from "@/actions/disponibilidade";
import { Input, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { WEEKDAY_LABELS } from "@/lib/types";
import { cn } from "@/lib/cn";
import type { UnitBusinessHours } from "@/lib/types";

type DayState = { active: boolean; start_time: string; end_time: string };

function toDayStates(hours: UnitBusinessHours[]): DayState[] {
  return Array.from({ length: 7 }).map((_, weekday) => {
    const row = hours.find((h) => h.weekday === weekday);
    return {
      active: row?.active ?? false,
      start_time: row?.start_time?.slice(0, 5) ?? "09:00",
      end_time: row?.end_time?.slice(0, 5) ?? "19:00",
    };
  });
}

export function UnitBusinessHoursEditor({
  unitId,
  hours,
}: {
  unitId: string;
  hours: UnitBusinessHours[];
}) {
  const { show } = useToast();
  const [days, setDays] = useState<DayState[]>(() => toDayStates(hours));
  const [pending, startTransition] = useTransition();
  const [savingDay, setSavingDay] = useState<number | null>(null);

  function updateDay(weekday: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, i) => (i === weekday ? { ...d, ...patch } : d)));
  }

  function saveDay(weekday: number) {
    const day = days[weekday];
    setSavingDay(weekday);
    startTransition(async () => {
      const result = await setUnitBusinessHoursDay({
        unit_id: unitId,
        weekday,
        start_time: day.start_time,
        end_time: day.end_time,
        active: day.active,
      });
      setSavingDay(null);
      if (!result.ok) return show(result.error, "danger");
      show(`${WEEKDAY_LABELS[weekday]} salvo.`, "success");
    });
  }

  return (
    <div className="rounded-md border border-border bg-surface divide-y divide-border">
      {days.map((day, weekday) => (
        <div key={weekday} className="flex items-center gap-3 flex-wrap px-4 py-3">
          <label className="flex items-center gap-2 w-28 shrink-0">
            <Checkbox checked={day.active} onChange={(e) => updateDay(weekday, { active: e.target.checked })} />
            <span className={cn("text-body-sm font-medium", !day.active && "text-muted")}>
              {WEEKDAY_LABELS[weekday]}
            </span>
          </label>

          {day.active && (
            <>
              <Input
                type="time"
                value={day.start_time}
                onChange={(e) => updateDay(weekday, { start_time: e.target.value })}
                className="w-28"
              />
              <span className="text-muted text-body-sm">até</span>
              <Input
                type="time"
                value={day.end_time}
                onChange={(e) => updateDay(weekday, { end_time: e.target.value })}
                className="w-28"
              />
            </>
          )}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            pending={pending && savingDay === weekday}
            onClick={() => saveDay(weekday)}
            className="ml-auto"
          >
            Salvar
          </Button>
        </div>
      ))}
    </div>
  );
}
