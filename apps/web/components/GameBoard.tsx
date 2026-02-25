"use client";

import clsx from "clsx";
import { useMemo } from "react";

export interface TileClaim {
  name: string;
  headshotUrl?: string | null;
}

export const GameBoard = ({
  board,
  rowLabels,
  colLabels,
  usedAnswers,
  cellAnswersByIndex,
  hoverSymbol = "X",
  onCell,
  disabled,
  size = 3,
  compact = false
}: {
  board: ("X" | "O" | null)[];
  rowLabels?: string[];
  colLabels?: string[];
  usedAnswers?: string[];
  cellAnswersByIndex?: Record<number, TileClaim>;
  hoverSymbol?: "X" | "O";
  onCell: (i: number) => void;
  disabled?: boolean;
  size?: 3 | 4;
  compact?: boolean;
}) => {
  const fallbackImageUrl = (name: string, seed: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=256&background=1f2937&color=f8fafc&bold=true&rounded=true&format=png&seed=${encodeURIComponent(seed)}`;

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
    let start = winLine[0]!;
    let end = winLine[winLine.length - 1]!;
    const sr0 = Math.floor(start / size);
    const sc0 = start % size;
    const er0 = Math.floor(end / size);
    const ec0 = end % size;
    if (sc0 > ec0 || (sc0 === ec0 && sr0 > er0)) {
      [start, end] = [end, start];
    }
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
  const lineKey = winLine ? winLine.join("-") : "none";

  if (compact) {
    const boardSizeClass = "w-[min(60vw,600px)] max-w-[600px]";
    const boardGapClass = "gap-5";
    const promptTextClass =
      "flex h-full items-center justify-center px-2 text-center text-xs font-semibold uppercase tracking-wide leading-tight text-[#b8b8b8]";
    const hoverBorderClass = hoverSymbol === "X" ? "hover:border-blue-500/70" : "hover:border-[#f97316]/70";

    return (
      <div className="relative z-10 w-full max-w-[960px]">
        <div className="hidden gap-2 md:grid md:grid-cols-[180px_1fr]">
          <div className={clsx("grid py-5", boardGapClass, "h-[min(60vw,600px)]")} style={{ gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}>
            {(rowLabels ?? Array(size).fill("Row prompt")).map((label, idx) => (
              <div key={`cr-${idx}`} className={clsx(promptTextClass, "self-center")}>
                {label}
              </div>
            ))}
          </div>
          <div>
            <div className={clsx("mx-auto mb-3 grid px-5", boardGapClass, boardSizeClass)} style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
              {(colLabels ?? Array(size).fill("Column prompt")).map((label, idx) => (
                <div key={`cc-${idx}`} className={promptTextClass}>
                  {label}
                </div>
              ))}
            </div>
            <div className={clsx("relative mx-auto aspect-square rounded-xl border-2 border-[#4a4a4a]/60 bg-[#1e1e1e] p-5", boardSizeClass)}>
              <div className="pointer-events-none absolute left-1/2 top-0 h-16 w-32 -translate-x-1/2 rounded-b-full border-b-2 border-l-2 border-r-2 border-[#4a4a4a]/40" />
              <div className="pointer-events-none absolute bottom-0 left-1/2 h-16 w-32 -translate-x-1/2 rounded-t-full border-l-2 border-r-2 border-t-2 border-[#4a4a4a]/40" />
              <div className={clsx("grid h-full w-full", boardGapClass)} style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}>
                {board.map((value, idx) => {
                  const row = Math.floor(idx / size);
                  const col = idx % size;
                  const coord = `${String.fromCharCode(65 + row)}${col + 1}`;
                  const answer = cellAnswersByIndex?.[idx];
                  const answerImage = answer ? answer.headshotUrl || fallbackImageUrl(answer.name, `${idx}`) : null;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={clsx(
                        "focusable board-cell group relative flex aspect-square items-center justify-center overflow-hidden rounded border-2 border-[#4a4a4a]/60 transition-all duration-200",
                        value ? "cursor-default bg-[#121212]" : clsx("cursor-pointer bg-[#121212]/60", hoverBorderClass),
                        disabled && "cursor-not-allowed opacity-80"
                      )}
                      onClick={() => onCell(idx)}
                      disabled={disabled || value !== null}
                      aria-label={`Cell ${idx + 1}`}
                    >
                      {value === "X" && !answer && (
                        <span className="material-symbols-outlined text-6xl text-blue-500 [filter:drop-shadow(0_0_8px_rgba(59,130,246,0.5))]">close</span>
                      )}
                      {value === "O" && !answer && (
                        <span className="material-symbols-outlined text-6xl text-[#f97316] [filter:drop-shadow(0_0_8px_rgba(249,115,22,0.5))]">circle</span>
                      )}
                      {!value && (
                        <span className={clsx("material-symbols-outlined scale-75 text-6xl opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-30", hoverSymbol === "X" ? "text-blue-500" : "text-[#f97316]")}>
                          {hoverSymbol === "X" ? "close" : "circle"}
                        </span>
                      )}
                      {answer && answerImage && (
                        <div className="animate-claim-pop absolute inset-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={answerImage}
                            alt={answer.name}
                            className="h-full w-full object-cover opacity-90"
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              const fb = fallbackImageUrl(answer.name, `${idx}-fb`);
                              if (img.src !== fb) img.src = fb;
                            }}
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-black/10 p-2">
                            <span className="line-clamp-2 text-center text-[10px] font-semibold text-white">{answer.name}</span>
                          </div>
                          <span
                            className={clsx(
                              "material-symbols-outlined pointer-events-none absolute inset-0 grid place-items-center text-[112px] leading-none",
                              value === "X"
                                ? "text-blue-400/95 [text-shadow:0_0_16px_rgba(59,130,246,0.65)]"
                                : "text-[#f97316]/95 [text-shadow:0_0_16px_rgba(249,115,22,0.65)]"
                            )}
                          >
                            {value === "X" ? "close" : "circle"}
                          </span>
                        </div>
                      )}
                      <span className="absolute bottom-2 right-2 font-mono text-[10px] text-[#a3a3a3] opacity-50">{coord}</span>
                    </button>
                  );
                })}
              </div>
              {winLine && lineStyle && (
                <div
                  key={lineKey}
                  className="pointer-events-none absolute h-1 origin-left rounded-full bg-gradient-to-r from-orange-300 to-red-400 shadow-glowOrange"
                  style={lineStyle}
                />
              )}
            </div>
          </div>
        </div>

        <div className="md:hidden">
          <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {(colLabels ?? Array(size).fill("Column prompt")).map((label, idx) => (
              <div key={`mcc-${idx}`} className="flex min-h-[48px] items-center justify-center px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide leading-tight text-[#b8b8b8]">
                {label}
              </div>
            ))}
          </div>
          <div className="relative mx-auto aspect-square w-[min(92vw,680px)] max-w-[680px] rounded-xl border-2 border-[#4a4a4a]/60 bg-[#1e1e1e] p-4">
            <div className="grid h-full w-full gap-3" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}>
              {board.map((value, idx) => {
                const row = Math.floor(idx / size);
                const col = idx % size;
                const coord = `${String.fromCharCode(65 + row)}${col + 1}`;
                const answer = cellAnswersByIndex?.[idx];
                const answerImage = answer ? answer.headshotUrl || fallbackImageUrl(answer.name, `${idx}`) : null;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={clsx(
                      "focusable board-cell group relative flex aspect-square items-center justify-center overflow-hidden rounded border-2 border-[#4a4a4a]/60 transition-all duration-200",
                      value ? "cursor-default bg-[#121212]" : clsx("cursor-pointer bg-[#121212]/60", hoverBorderClass),
                      disabled && "cursor-not-allowed opacity-80"
                    )}
                    onClick={() => onCell(idx)}
                    disabled={disabled || value !== null}
                    aria-label={`Cell ${idx + 1}`}
                  >
                    {value === "X" && !answer && <span className="material-symbols-outlined text-5xl text-blue-500">close</span>}
                    {value === "O" && !answer && <span className="material-symbols-outlined text-5xl text-[#f97316]">circle</span>}
                    {!value && (
                      <span className={clsx("material-symbols-outlined scale-75 text-5xl opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-30", hoverSymbol === "X" ? "text-blue-500" : "text-[#f97316]")}>
                        {hoverSymbol === "X" ? "close" : "circle"}
                      </span>
                    )}
                    {answer && answerImage && (
                      <div className="animate-claim-pop absolute inset-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={answerImage}
                          alt={answer.name}
                          className="h-full w-full object-cover opacity-90"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            const fb = fallbackImageUrl(answer.name, `${idx}-fb`);
                            if (img.src !== fb) img.src = fb;
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-black/10 p-1.5">
                          <span className="line-clamp-2 text-center text-[9px] font-semibold text-white">{answer.name}</span>
                        </div>
                        <span
                          className={clsx(
                            "material-symbols-outlined pointer-events-none absolute inset-0 grid place-items-center text-[86px] leading-none",
                            value === "X"
                              ? "text-blue-400/95 [text-shadow:0_0_14px_rgba(59,130,246,0.65)]"
                              : "text-[#f97316]/95 [text-shadow:0_0_14px_rgba(249,115,22,0.65)]"
                          )}
                        >
                          {value === "X" ? "close" : "circle"}
                        </span>
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 font-mono text-[9px] text-[#a3a3a3] opacity-50">{coord}</span>
                  </button>
                );
              })}
            </div>
            {winLine && lineStyle && <div key={lineKey} className="pointer-events-none absolute h-1 origin-left rounded-full bg-gradient-to-r from-orange-300 to-red-400" style={lineStyle} />}
          </div>
          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {(rowLabels ?? Array(size).fill("Row prompt")).map((label, idx) => (
              <div key={`mr-${idx}`} className="flex min-h-[48px] items-center justify-center px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide leading-tight text-[#b8b8b8]">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
          <div className="court-stage relative grid gap-2 p-3" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }} role="grid" aria-label="NBA Tic-Tac-Toe board">
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
                <span className="relative z-10 transition group-active:scale-110">
                  {value === "X" && <span className="material-symbols-outlined text-6xl text-blue-500">close</span>}
                  {value === "O" && <span className="material-symbols-outlined text-6xl text-[#f97316]">circle</span>}
                </span>
                {cellAnswersByIndex?.[idx] && (
                  <span className="absolute left-2 right-2 top-2 line-clamp-2 text-center text-[10px] text-white/90">
                    {cellAnswersByIndex[idx]?.name}
                  </span>
                )}
              </button>
            ))}
            {winLine && lineStyle && (
              <div className="pointer-events-none absolute h-1 origin-left rounded-full bg-gradient-to-r from-orange-300 to-red-400 shadow-glowOrange" style={lineStyle} />
            )}
          </div>
        </div>
      </div>
      {!!usedAnswers?.length && <div className="mt-2 rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-xs text-slate-100/90">Used players: {usedAnswers.join(", ")}</div>}
    </div>
  );
};
