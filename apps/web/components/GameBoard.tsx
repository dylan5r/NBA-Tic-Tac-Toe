"use client";

import clsx from "clsx";
import { useMemo } from "react";

export const GameBoard = ({
  board,
  rowLabels,
  colLabels,
  usedAnswers,
  onCell,
  disabled,
  size = 3
}: {
  board: ("X" | "O" | null)[];
  rowLabels?: string[];
  colLabels?: string[];
  usedAnswers?: string[];
  onCell: (i: number) => void;
  disabled?: boolean;
  size?: 3 | 4;
}) => {
  const winLine = useMemo(() => {
    const lines =
      size === 3
        ? [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
          ]
        : [];
    for (const line of lines) {
      const first = board[line[0]!];
      if (!first) continue;
      if (line.every((idx) => board[idx] === first)) return line;
    }
    return null;
  }, [board, size]);

  const lineStyle = useMemo(() => {
    if (!winLine) return null;
    const start = winLine[0]!;
    const end = winLine[winLine.length - 1]!;
    const sr = Math.floor(start / size);
    const sc = start % size;
    const er = Math.floor(end / size);
    const ec = end % size;
    const toPct = (n: number) => ((n + 0.5) / size) * 100;
    const x1 = toPct(sc);
    const y1 = toPct(sr);
    const x2 = toPct(ec);
    const y2 = toPct(er);
    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    return {
      left: `${x1}%`,
      top: `${y1}%`,
      width: `${length}%`,
      transform: `translateY(-50%) rotate(${angle}deg)`
    };
  }, [size, winLine]);

  return (
    <div className="mx-auto w-[900px] max-w-full">
      <div className="grid gap-2 md:grid-cols-[220px_1fr]">
        <div className="grid gap-2" style={{ gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}>
          {(rowLabels ?? Array(size).fill("Row prompt")).map((label, idx) => (
            <div key={`r-${idx}`} className="min-h-[72px] rounded-xl border border-orange-300/35 bg-slate-900/80 px-2 py-2 text-[11px] leading-tight text-orange-100">
              {label}
            </div>
          ))}
        </div>
        <div>
          <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {(colLabels ?? Array(size).fill("Column prompt")).map((label, idx) => (
              <div key={`c-${idx}`} className="min-h-[72px] rounded-xl border border-sky-300/35 bg-slate-900/80 px-2 py-2 text-[11px] leading-tight text-sky-100">
                {label}
              </div>
            ))}
          </div>
          <div
            className="court-stage relative grid gap-2 p-3"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            role="grid"
            aria-label="NBA Tic-Tac-Toe board"
          >
            {board.map((value, idx) => (
              <button
                key={idx}
                type="button"
                className={clsx(
                  "focusable group relative aspect-square rounded-2xl border border-white/20 bg-black/25 text-5xl font-black transition duration-200 ease-out",
                  "hover:-translate-y-0.5 hover:border-orange-200/70 hover:shadow-glowOrange",
                  disabled && "cursor-not-allowed opacity-80"
                )}
                onClick={() => onCell(idx)}
                disabled={disabled || value !== null}
                aria-label={`Cell ${idx + 1}`}
              >
                <span className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.1),transparent_60%)] opacity-0 transition group-hover:opacity-100" />
                <span className={clsx("relative z-10 transition group-active:scale-110", value === "X" ? "text-orange-300" : "text-sky-300")}>
                  {value ?? ""}
                </span>
              </button>
            ))}
            {winLine && lineStyle && (
              <div
                className="pointer-events-none absolute h-1 origin-left animate-draw-line rounded-full bg-gradient-to-r from-orange-300 to-red-400 shadow-glowOrange"
                style={lineStyle}
              />
            )}
          </div>
        </div>
      </div>
      {!!usedAnswers?.length && (
        <div className="mt-2 rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-xs text-slate-100/90">
          Used players: {usedAnswers.join(", ")}
        </div>
      )}
    </div>
  );
};
