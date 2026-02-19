"use client";

import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger";
type Size = "md" | "lg";

export const UIButton = ({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) => (
  <button
    {...props}
    className={clsx(
      "focusable inline-flex items-center justify-center rounded-lg font-bold uppercase tracking-tight transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
      size === "lg" ? "px-10 py-4 text-lg" : "px-4 py-2 text-sm",
      variant === "primary" && "bg-[#ee8c2b] text-[#221910] hover:bg-[#da7d22]",
      variant === "secondary" && "bg-white/10 border border-white/20 text-white hover:bg-white/15",
      variant === "danger" && "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20",
      className
    )}
  >
    {children}
  </button>
);

