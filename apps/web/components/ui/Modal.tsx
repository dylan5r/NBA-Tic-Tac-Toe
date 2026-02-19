"use client";

export const UIModal = ({
  open,
  title,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <section className="surface w-[760px] max-w-full rounded-xl p-6">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black uppercase tracking-tight">{title}</h2>
          <button className="focusable rounded-lg border border-white/20 px-3 py-1 text-xs uppercase" onClick={onClose}>Close</button>
        </header>
        <div>{children}</div>
      </section>
    </div>
  );
};

