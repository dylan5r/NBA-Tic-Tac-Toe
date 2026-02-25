import clsx from "clsx";
import Link from "next/link";

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
      "group card-hover relative flex h-full flex-col overflow-hidden rounded-xl border p-8 transition-all",
      "bg-[#1e1e1e] border-[#2a2a2a]",
      accent === "orange" && "hover:border-[#ee8c2b]",
      accent === "blue" && "hover:border-sky-400",
      accent === "red" && "hover:border-rose-400",
      accent === "neutral" && "hover:border-[#ee8c2b]"
    )}
  >
    <div className="absolute -right-4 -top-4 size-24 rounded-full bg-[#ee8c2b]/5 group-hover:bg-[#ee8c2b]/10" />
    <div className="mb-6 size-14 rounded-xl bg-[#ee8c2b] flex items-center justify-center shadow-lg shadow-[#ee8c2b]/20">
      <span className="material-symbols-outlined text-[#221910] text-3xl font-bold">sports_basketball</span>
    </div>
    <h4 className="text-xl font-bold mb-3 uppercase tracking-tight">{title}</h4>
    <p className="text-slate-400 text-sm leading-relaxed mb-8">{description}</p>
    <div className="mt-auto flex items-center justify-between">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#ee8c2b]">Play Mode</span>
      <span className="material-symbols-outlined text-[#ee8c2b]/40 group-hover:text-[#ee8c2b]">arrow_forward_ios</span>
    </div>
  </Link>
);

