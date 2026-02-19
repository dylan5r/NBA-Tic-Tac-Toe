"use client";

import { useApp } from "../app/providers";
import { UIModal } from "./ui/Modal";
import { UIButton } from "./ui/Button";

export const SettingsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { settings, setSettings } = useApp();

  const toggle = (key: keyof typeof settings) => setSettings({ ...settings, [key]: !settings[key] });

  return (
    <UIModal open={open} onClose={onClose} title="Arena Settings">
      <div className="space-y-3">
        {(["sound", "animations", "highContrast", "reduceMotion"] as const).map((key) => (
          <label key={key} className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black/25 p-3">
            <span className="font-semibold capitalize text-slate-100">{key}</span>
            <input className="focusable h-4 w-4 accent-orange-500" type="checkbox" checked={settings[key]} onChange={() => toggle(key)} />
          </label>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <UIButton onClick={onClose}>Save</UIButton>
      </div>
    </UIModal>
  );
};
