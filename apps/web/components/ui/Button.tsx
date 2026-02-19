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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) => {
  return (
    <button
      {...props}
      className={clsx(
        "focusable btn-shimmer rounded-xl border font-display uppercase tracking-[0.12em] transition duration-200 ease-out active:scale-[0.98]",
        size === "lg" ? "px-7 py-3 text-lg" : "px-4 py-2 text-sm",
        variant === "primary" &&
          "border-orange-300/50 bg-gradient-to-b from-orange-400 to-orange-600 text-black shadow-glowOrange hover:brightness-110",
        variant === "secondary" &&
          "border-sky-300/40 bg-gradient-to-b from-slate-700 to-slate-900 text-slate-100 shadow-glowBlue hover:border-sky-300/75",
        variant === "danger" &&
          "border-rose-300/45 bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-[0_0_0_1px_rgba(255,80,95,0.45),0_0_16px_rgba(255,62,73,0.35)] hover:brightness-110",
        className
      )}
    >
      {children}
    </button>
  );
};
