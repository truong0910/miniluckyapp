export default function Background() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-gradient-to-b from-red-950 via-slate-950 to-red-950">
      {/* Dynamic Glowing Radial Lights */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] bg-amber-500/15 rounded-full blur-[60px] animate-pulse" />
      <div className="absolute top-1/3 left-10 w-64 h-64 bg-red-600/15 rounded-full blur-[60px]" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-amber-600/10 rounded-full blur-[60px]" />

      {/* Decorative Light Sparkles / Bokeh */}
      <div className="absolute top-12 left-8 w-2 h-2 bg-amber-300 rounded-full shadow-[0_0_12px_#fde047] opacity-80 animate-pulse" />
      <div className="absolute top-28 right-12 w-3 h-3 bg-yellow-200 rounded-full shadow-[0_0_16px_#fef08a] opacity-75 animate-ping" />
      <div className="absolute top-1/2 left-6 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_14px_#fbbf24] opacity-60" />
      <div className="absolute bottom-1/4 right-8 w-2 h-2 bg-red-300 rounded-full shadow-[0_0_10px_#fca5a5] opacity-70" />
    </div>
  );
}
