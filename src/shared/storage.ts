// Versioned, namespaced save slots on top of localStorage.
//
// localStorage is shared by every page under vb6enjoyer.github.io (all repos),
// so keys are prefixed with "lolbertarianism:<game>". Each save stores a
// schema version so the data shape can change later without breaking old saves.

const PREFIX = 'lolbertarianism:';

interface Envelope {
  v: number;
  data: unknown;
}

export interface SaveSlotOptions<T> {
  /** Game slug, used in the storage key. */
  game: string;
  /** Current schema version. Bump it when the save shape changes. */
  version: number;
  /** Older keys to import from if there is no save under the new key (read as version 0). */
  legacyKeys?: string[];
  /** Turns a save from an older version into the current shape. Defaults to returning it unchanged. */
  migrate?: (data: unknown, fromVersion: number) => T;
}

export interface SaveSlot<T> {
  /** The saved data, or null if there is none or it can't be read. */
  load(): T | null;
  save(data: T): void;
  /** Deletes the save, including any legacy copies. */
  clear(): void;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked (private mode, disabled cookies…)
  }
}

export function createSaveSlot<T>({
  game,
  version,
  legacyKeys = [],
  migrate = (data) => data as T,
}: SaveSlotOptions<T>): SaveSlot<T> {
  const key = PREFIX + game;

  function parse(raw: string, legacy: boolean): Envelope | null {
    try {
      const json: unknown = JSON.parse(raw);
      return legacy ? { v: 0, data: json } : (json as Envelope);
    } catch {
      return null;
    }
  }

  return {
    load() {
      let envelope: Envelope | null = null;
      const current = read(key);
      if (current !== null) {
        envelope = parse(current, false);
      } else {
        for (const legacyKey of legacyKeys) {
          const raw = read(legacyKey);
          if (raw !== null && (envelope = parse(raw, true))) break;
        }
      }
      if (!envelope || envelope.data == null) return null;
      return envelope.v === version ? (envelope.data as T) : migrate(envelope.data, envelope.v);
    },

    save(data) {
      try {
        localStorage.setItem(key, JSON.stringify({ v: version, data } satisfies Envelope));
      } catch {
        // storage full or blocked: keep playing without saving
      }
    },

    clear() {
      try {
        localStorage.removeItem(key);
        for (const legacyKey of legacyKeys) localStorage.removeItem(legacyKey);
      } catch {
        // nothing to clear
      }
    },
  };
}
