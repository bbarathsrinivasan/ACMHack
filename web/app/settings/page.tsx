"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { DayKey, PreferredTime, UserSettings } from "@/lib/localStore";
import { DEFAULT_SETTINGS, clearUserSettings, loadUserSettings, saveUserSettings } from "@/lib/localStore";

const DAY_LABEL: Record<DayKey, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

const PREFERRED_TIMES: { key: PreferredTime; label: string }[] = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "night", label: "Night" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    setSettings(loadUserSettings());
  }, []);

  // Auto-save with debounce
  useEffect(() => {
    let clearId: ReturnType<typeof setTimeout> | undefined;
    const id = setTimeout(() => {
      saveUserSettings(settings);
      setStatus("Saved");
      clearId = setTimeout(() => setStatus(""), 1200);
    }, 300);
    return () => {
      clearTimeout(id);
      if (clearId) clearTimeout(clearId);
    };
  }, [settings]);

  const totalAvailPerDay = useMemo(() => {
    // compute available minutes for each enabled day
    const mins: Record<DayKey, number> = { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 };
    for (const d of Object.keys(settings.availability.byDay) as DayKey[]) {
      const day = settings.availability.byDay[d];
      if (!day.enabled) continue;
      mins[d] = diffMinutes(day.start, day.end);
    }
    return mins;
  }, [settings.availability.byDay]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure availability and study preferences. {status && <span className="text-xs text-muted-foreground">{status}</span>}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setSettings(loadUserSettings())}>Reload</Button>
          <Button
            variant="outline"
            onClick={() => {
              clearUserSettings();
              setSettings(DEFAULT_SETTINGS);
            }}
          >
            Reset to defaults
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
            <CardDescription>Weekly time windows, max minutes per day, and protected hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Weekly windows</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(settings.availability.byDay) as DayKey[]).map((d) => {
                  const day = settings.availability.byDay[d];
                  return (
                    <div key={d} className="border rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium select-none">
                          <input
                            type="checkbox"
                            className="mr-2 align-middle"
                            checked={day.enabled}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                availability: {
                                  ...s.availability,
                                  byDay: {
                                    ...s.availability.byDay,
                                    [d]: { ...day, enabled: e.target.checked },
                                  },
                                },
                              }))
                            }
                          />
                          {DAY_LABEL[d]}
                        </label>
                        {day.enabled ? (
                          <Badge variant="secondary">{minsToHhMm(totalAvailPerDay[d])}</Badge>
                        ) : (
                          <Badge variant="outline">off</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 opacity-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Start</span>
                          <Input
                            type="time"
                            value={day.start}
                            className="rounded-xl h-10 bg-background/50"
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                availability: {
                                  ...s.availability,
                                  byDay: {
                                    ...s.availability.byDay,
                                    [d]: { ...day, start: e.target.value },
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">End</span>
                          <Input
                            type="time"
                            value={day.end}
                            className="rounded-xl h-10 bg-background/50"
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                availability: {
                                  ...s.availability,
                                  byDay: {
                                    ...s.availability.byDay,
                                    [d]: { ...day, end: e.target.value },
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Max minutes/day</label>
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  value={settings.availability.maxMinutesPerDay}
                  className="rounded-xl h-10"
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      availability: { ...s.availability, maxMinutesPerDay: clampInt(e.target.valueAsNumber, 0, 1440) },
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Protected start</label>
                <Input
                  type="time"
                  value={settings.availability.protectedHours.start}
                  className="rounded-xl h-10 bg-background/50"
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      availability: { ...s.availability, protectedHours: { ...s.availability.protectedHours, start: e.target.value } },
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Protected end</label>
                <Input
                  type="time"
                  value={settings.availability.protectedHours.end}
                  className="rounded-xl h-10 bg-background/50"
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      availability: { ...s.availability, protectedHours: { ...s.availability.protectedHours, end: e.target.value } },
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Preferred study times, breaks, and guided mode.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Preferred study times</div>
              <div className="flex flex-wrap gap-2">
                {PREFERRED_TIMES.map((opt) => {
                  const active = settings.preferences.preferredStudyTimes.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      className={`px-3 py-1 rounded-full border text-sm ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          preferences: {
                            ...s.preferences,
                            preferredStudyTimes: toggleInArray(s.preferences.preferredStudyTimes, opt.key),
                          },
                        }))
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Pomodoro-style breaks</div>
                <div className="grid grid-cols-2 gap-3">
                  <LabeledNumber
                    label="Work (min)"
                    value={settings.preferences.breaks.workMinutes}
                    min={15}
                    max={120}
                    onChange={(v) =>
                      setSettings((s) => ({
                        ...s,
                        preferences: { ...s.preferences, breaks: { ...s.preferences.breaks, workMinutes: v } },
                      }))
                    }
                  />
                  <LabeledNumber
                    label="Short break"
                    value={settings.preferences.breaks.shortBreakMinutes}
                    min={3}
                    max={30}
                    onChange={(v) =>
                      setSettings((s) => ({
                        ...s,
                        preferences: { ...s.preferences, breaks: { ...s.preferences.breaks, shortBreakMinutes: v } },
                      }))
                    }
                  />
                  <LabeledNumber
                    label="Long break"
                    value={settings.preferences.breaks.longBreakMinutes}
                    min={5}
                    max={60}
                    onChange={(v) =>
                      setSettings((s) => ({
                        ...s,
                        preferences: { ...s.preferences, breaks: { ...s.preferences.breaks, longBreakMinutes: v } },
                      }))
                    }
                  />
                  <LabeledNumber
                    label="Long interval"
                    value={settings.preferences.breaks.longBreakInterval}
                    min={2}
                    max={8}
                    onChange={(v) =>
                      setSettings((s) => ({
                        ...s,
                        preferences: { ...s.preferences, breaks: { ...s.preferences.breaks, longBreakInterval: v } },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Strict guided mode</div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.preferences.strictGuidedMode}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        preferences: { ...s.preferences, strictGuidedMode: e.target.checked },
                      }))
                    }
                  />
                  Enforce step-by-step hints in Tutor and Planner
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LabeledNumber({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        className="rounded-xl h-10"
        onChange={(e) => onChange(clampInt(e.target.valueAsNumber, min, max))}
      />
    </div>
  );
}

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function toggleInArray<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = end.split(":").map((x) => parseInt(x, 10));
  const s = sh * 60 + sm;
  let e = eh * 60 + em;
  if (e < s) e += 24 * 60; // cross midnight
  return e - s;
}

function minsToHhMm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
