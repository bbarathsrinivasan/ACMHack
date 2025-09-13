// Simple typed localStorage helpers for Settings
// Guards for SSR and JSON parsing errors.

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type PreferredTime = "morning" | "afternoon" | "evening" | "night";

export interface DayAvailability {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface AvailabilitySettings {
  byDay: Record<DayKey, DayAvailability>;
  maxMinutesPerDay: number; // 0-1440
  protectedHours: { start: string; end: string }; // applies daily
}

export interface BreaksSettings {
  workMinutes: number; // study block length
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number; // every N work blocks
}

export interface UserSettings {
  availability: AvailabilitySettings;
  preferences: {
    preferredStudyTimes: PreferredTime[];
    breaks: BreaksSettings;
    strictGuidedMode: boolean;
  };
}

const STORAGE_KEY = "acmhack:user-settings:v1";

// Reasonable defaults
export const DEFAULT_SETTINGS: UserSettings = {
  availability: {
    byDay: {
      sun: { enabled: false, start: "09:00", end: "17:00" },
      mon: { enabled: true, start: "09:00", end: "18:00" },
      tue: { enabled: true, start: "09:00", end: "18:00" },
      wed: { enabled: true, start: "09:00", end: "18:00" },
      thu: { enabled: true, start: "09:00", end: "18:00" },
      fri: { enabled: true, start: "09:00", end: "17:00" },
      sat: { enabled: true, start: "10:00", end: "14:00" },
    },
    maxMinutesPerDay: 240,
    protectedHours: { start: "22:00", end: "07:00" },
  },
  preferences: {
    preferredStudyTimes: ["evening"],
    breaks: { workMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20, longBreakInterval: 3 },
    strictGuidedMode: false,
  },
};

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadUserSettings(): UserSettings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    // Shallow merge onto defaults to tolerate older versions
    return deepMerge(DEFAULT_SETTINGS, parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota or serialization errors
  }
}

export function clearUserSettings(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Minimal deep merge for our nested shape
type PlainObject = { [key: string]: unknown };

function isPlainObject(v: unknown): v is PlainObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override as T) ?? base;
  }
  const out: PlainObject = { ...(base as PlainObject) };
  for (const key of Object.keys(override as PlainObject)) {
    const b = (base as PlainObject)[key];
    const o = (override as PlainObject)[key];
    if (isPlainObject(b) && isPlainObject(o)) {
      out[key] = deepMerge(b as object, o as object) as unknown;
    } else if (o !== undefined) {
      out[key] = o as unknown;
    }
  }
  return out as T;
}
