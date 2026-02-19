"use client";

import { useApp } from "../app/providers";
import { UIModal } from "./ui/Modal";
import { UIButton } from "./ui/Button";

export const SettingsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { settings, setSettings } = useApp();

  const set = (key: keyof typeof settings) => setSettings({ ...settings, [key]: !settings[key] });

  return (
    <UIModal open={open} onClose={onClose} title="Arena Settings">
      <div className="space-y-3">
        {(["sound", "animations", "highContrast", "reduceMotion"] as const).map((k) => (
          <label key={k} className="flex cursor-pointer items-center justify-between rounded-xl border border-white/15 bg-black/25 p-3">
            <span className="font-semibold capitalize">{k}</span>
            <input className="focusable h-4 w-4 accent-orange-500" type="checkbox" checked={settings[k]} onChange={() => set(k)} />
          </label>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <UIButton onClick={onClose}>Done</UIButton>
      </div>
    </UIModal>
  );
};
