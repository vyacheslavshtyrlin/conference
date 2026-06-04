import { create } from "zustand";
import { SESSION_KEYS } from "../storage/sessionStorageKeys";

type LocalMediaPreferences = {
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
};

type LocalMediaState = LocalMediaPreferences & {
  displayName: string;
  deviceError: string | null;
  setDisplayName: (displayName: string) => void;
  setMicEnabled: (enabled: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  setScreenEnabled: (enabled: boolean) => void;
  setDeviceError: (error: string | null) => void;
};

function loadPreferences(): LocalMediaPreferences {
  const fallback = { micEnabled: true, cameraEnabled: true, screenEnabled: false };

  try {
    const raw = sessionStorage.getItem(SESSION_KEYS.localMedia);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function savePreferences(state: LocalMediaPreferences) {
  sessionStorage.setItem(SESSION_KEYS.localMedia, JSON.stringify(state));
}

function loadDisplayName() {
  return sessionStorage.getItem(SESSION_KEYS.displayName) ?? "";
}

export const useLocalMediaStore = create<LocalMediaState>((set, get) => ({
  ...loadPreferences(),
  displayName: loadDisplayName(),
  deviceError: null,
  setDisplayName: (displayName) => {
    sessionStorage.setItem(SESSION_KEYS.displayName, displayName);
    set({ displayName });
  },
  setMicEnabled: (micEnabled) => {
    const next = { micEnabled, cameraEnabled: get().cameraEnabled, screenEnabled: get().screenEnabled };
    savePreferences(next);
    set({ micEnabled });
  },
  setCameraEnabled: (cameraEnabled) => {
    const next = { micEnabled: get().micEnabled, cameraEnabled, screenEnabled: get().screenEnabled };
    savePreferences(next);
    set({ cameraEnabled });
  },
  setScreenEnabled: (screenEnabled) => {
    const next = { micEnabled: get().micEnabled, cameraEnabled: get().cameraEnabled, screenEnabled };
    savePreferences(next);
    set({ screenEnabled });
  },
  setDeviceError: (deviceError) => {
    set({ deviceError });
  },
}));
