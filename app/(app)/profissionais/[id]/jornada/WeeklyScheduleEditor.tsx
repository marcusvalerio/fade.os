"use client";

import { useState, useTransition } from "react";
import { setProfessionalScheduleDay, addScheduleBreak, removeScheduleBreak } from "@/actions/disponibilidade";
import { Input, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { WEEKDAY_LABELS } from "@/lib/types";
import { cn } from "@/lib/cn";
import type { ProfessionalSchedule, ProfessionalScheduleBreak } from "@/lib/types";

type DayState = {
  id: string | null;
  active: boolean;
  start_time: string;
  end_time: string;
  breaks: ProfessionalScheduleBreak[];
};

function toDayStates(
  schedules: ProfessionalSchedule[],
  breaks: ProfessionalScheduleBreak[]
): DayState[] {
  return Array.from({ length: 7 }).map((_, weekday) => {
    const sched = schedules.find((s) => s.weekday === weekday);
    return {
      id: sched?.id ?? null,
      active: sched?.active ?? false,
      start_time: sched?.start_time?.slice(0, 5) ?? "09:00",
      end_time: sched?.end_time?.slice(0, 5) ?? "18:00",
      breaks: sched ? breaks.filter((b) => b.schedule_id === sched.id) : [],
    };
  });
}

export function WeeklyScheduleEditor({
  professionalId,
  schedules,
  breaks,
}: {
  professionalId: string;
  schedules: ProfessionalSchedule[];
  breaks: ProfessionalScheduleBreak[];
}) {
  const { show } = useToast();
  const [days, setDays] = useState<DayState[]>(() => toDayStates(schedules, breaks));
  const [pending, startTransition] = useTransition();
  const [savingDay, setSavingDay] = useState<number | null>(null);

  function updateDay(weekday: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, i) => (i === weekday ? { ...d, ...patch } : d)));
  }

  function saveDay(weekday: number) {
    const day = days[weekday];
    setSavingDay(weekday);
    startTransition(async () => {
      const result = await setProfessionalScheduleDay({
        professional_id: professionalId,
        weekday,
        start_time: day.start_time,
        end_time: day.end_time,
        active: day.active,
      });
      setSavingDay(null);
      if (!result.ok) return show(result.error, "danger");
      updateDay(weekday, { id: result.data.id });
      show(`${WEEKDAY_LABELS[weekday]} salvo.`, "success");
    });
  }

  function handleAddBreak(weekday: number, formData: FormData) {
    const day = days[weekday];
    if (!day.id) return;
    const start = String(formData.get("start_time") || "");
    const end = String(formData.get("end_time") || "");
    startTransition(async () => {
      const result = await addScheduleBreak(day.id as string, start, end);
      if (!result.ok) return show(result.error, "danger");
      updateDay(weekday, {
        breaks: [...day.breaks, { id: result.data.id, schedule_id: day.id as string, start_time: start, end_time: end }],
      });
      show("Intervalo adicionado.", "success");
    });
  }

  function handleRemoveBreak(weekday: number, breakId: string) {
    startTransition(async () => {
      const result = await removeScheduleBreak(breakId, professionalId);
      if (!result.ok) return show(result.error, "danger");
      updateDay(weekday, { breaks: days[weekday].breaks.filter((b) => b.id !== breakId) });
      show("Intervalo removido.", "success");
    });
  }

  return (
    <div className="space-y-3">
      {days.map((day, weekday) => (
        <div key={weekday} className="rounded-md border border-border bg-surface p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 w-32 shrink-0">
              <Checkbox
                checked={day.active}
                onChange={(e) => updateDay(weekday, { active: e.target.checked })}
              />
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

          {day.active && day.id && (
            <div className="mt-3 pl-[8.5rem] space-y-2">
              {day.breaks.map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-body-sm text-muted">
                  <span>
                    Intervalo {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBreak(weekday, b.id)}
                    className="text-danger hover:underline text-caption"
                  >
                    remover
                  </button>
                </div>
              ))}
              <form
                action={(fd) => handleAddBreak(weekday, fd)}
                className="flex items-center gap-2"
                key={day.breaks.length}
              >
                <Input type="time" name="start_time" defaultValue="12:00" className="w-28" />
                <span className="text-muted text-body-sm">até</span>
                <Input type="time" name="end_time" defaultValue="13:00" className="w-28" />
                <Button type="submit" size="sm" variant="ghost">
                  + intervalo
                </Button>
              </form>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
