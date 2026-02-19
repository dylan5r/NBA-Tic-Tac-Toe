"use client";

import type { PublicUser } from "@nba/contracts";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type SettingsState = {
  sound: boolean;
  animations: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
};

interface AppContextValue {
  user: PublicUser | null;
  setUser: (u: PublicUser | null) => void;
  settings: SettingsState;
  setSettings: (next: SettingsState) => void;
}

const defaultSettings: SettingsState = {
  sound: true,
  animations: true,
  highContrast: false,
  reduceMotion: false
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);

  useEffect(() => {
    const saved = localStorage.getItem("nba-ttt-settings");
    if (saved) setSettings(JSON.parse(saved) as SettingsState);
    const savedUser = localStorage.getItem("nba-ttt-user");
    if (savedUser) setUser(JSON.parse(savedUser) as PublicUser);
  }, []);

  useEffect(() => {
    localStorage.setItem("nba-ttt-settings", JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.highContrast ? "high-contrast" : "";
  }, [settings]);

  useEffect(() => {
    if (user) localStorage.setItem("nba-ttt-user", JSON.stringify(user));
  }, [user]);

  const value = useMemo(() => ({ user, setUser, settings, setSettings }), [user, settings]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProviders");
  return value;
};
