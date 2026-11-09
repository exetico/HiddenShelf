// Shared looks for the Tools page. Tailwind only keeps classes it can see
// written out in full, so each accent's classes are spelled out here.

export const INPUT =
  "w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 bg-white dark:bg-brand-800 text-gray-900 dark:text-white";
export const OUTLINE =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-brand-700 text-gray-800 dark:text-brand-100 hover:bg-gray-50 dark:hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed";
export const PRIMARY =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed";
export const SMALL =
  "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-brand-700 text-gray-700 dark:text-brand-200 hover:bg-gray-50 dark:hover:bg-brand-800 disabled:opacity-50";

// Icon tile and the soft corner glow on each tool's card
export const ACCENTS = {
  sky: {
    tile: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    glow: "to-sky-500/10 dark:to-sky-400/10",
    art: "text-sky-500 dark:text-sky-400",
  },
  amber: {
    tile: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    glow: "to-amber-500/10 dark:to-amber-400/10",
    art: "text-amber-500 dark:text-amber-400",
  },
  emerald: {
    tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    glow: "to-emerald-500/10 dark:to-emerald-400/10",
    art: "text-emerald-500 dark:text-emerald-400",
  },
  violet: {
    tile: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    glow: "to-violet-500/10 dark:to-violet-400/10",
    art: "text-violet-500 dark:text-violet-400",
  },
  rose: {
    tile: "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    glow: "to-rose-500/10 dark:to-rose-400/10",
    art: "text-rose-500 dark:text-rose-400",
  },
  slate: {
    tile: "bg-slate-200 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
    glow: "to-slate-500/10 dark:to-slate-400/10",
    art: "text-slate-500 dark:text-slate-400",
  },
};

// Little "found something" badges on the cards and in results
export const TONES = {
  good: "bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200",
  warn: "bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200",
  bad: "bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200",
  quiet: "bg-gray-100 text-gray-600 dark:bg-brand-800 dark:text-brand-300",
};
