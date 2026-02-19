import Link from "next/link";
import clsx from "clsx";

export const ModeCard = ({
  title,
  description,
  href,
  accent
}: {
  title: string;
  description: string;
  href: string;
  accent: "orange" | "blue" | "red" | "neutral";
}) => (
  <Link
    href={href}
    className={clsx(
      "focusable group relative block overflow-hidden rounded-2xl border p-5 transition duration-200 ease-out hover:-translate-y-1 hover:shadow-panel",
      "bg-gradient-to-b from-slate-800/95 to-slate-950/95",
      accent === "orange" && "border-orange-400/45 hover:shadow-glowOrange",
      accent === "blue" && "border-sky-400/45 hover:shadow-glowBlue",
      accent === "red" && "border-rose-400/45 hover:shadow-led",
      accent === "neutral" && "border-white/20 hover:border-white/45"
    )}
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_55%)] opacity-75 transition group-hover:opacity-100" />
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-0 transition group-hover:opacity-100" />
    <h3 className="relative font-display text-4xl uppercase leading-none tracking-wide">{title}</h3>
    <p className="relative mt-2 text-sm text-slate-300">{description}</p>
  </Link>
);
