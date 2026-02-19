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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={title}>
      <section className="glass w-[720px] max-w-[94vw] rounded-2xl border border-white/20 p-6">
        <header className="flex items-center justify-between">
          <h2 className="font-display text-4xl uppercase tracking-wider">{title}</h2>
          <button className="focusable rounded-md border border-white/20 px-3 py-1 text-sm" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
};
