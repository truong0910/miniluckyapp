import LogoImg from "@/static/logo.webp";

export default function Header() {
  return (
    <header className="header sticky top-0 z-40 px-4 py-2.5 border-b border-amber-500/20 bg-slate-950/85 backdrop-blur-md shadow-lg">
      <div className="mx-auto max-w-[420px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative p-1 rounded-2xl bg-gradient-to-tr from-amber-500/30 via-amber-400/20 to-amber-600/30 border border-amber-400/40 shadow-inner">
            <img
              src={LogoImg}
              alt="Logo"
              width={768}
              height={295}
              fetchPriority="high"
              decoding="async"
              className="h-9 w-auto object-contain drop-shadow-md rounded-xl"
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-black text-gold-gradient tracking-wide uppercase leading-tight">
              VÒNG QUAY MAY MẮN
            </span>
            <span className="text-[10px] text-amber-200/70 font-bold tracking-wider">
              Tri Ân Khách Hàng VIP
            </span>
          </div>
        </div>

        <div className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 font-extrabold text-[10px] uppercase tracking-wider shadow-sm">
          ✨ Official
        </div>
      </div>
    </header>
  );
}
