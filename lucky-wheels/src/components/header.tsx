import LogoImg from "@/static/logo.png";

export default function Header() {
  return (
    <header className="header sticky top-0 z-40 px-4 py-2.5 border-b border-red-500/30 bg-slate-950/90 backdrop-blur-md shadow-xl">
      <div className="mx-auto max-w-[420px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative p-1 rounded-xl bg-white border border-red-500/30 shadow-md">
            <img
              src={LogoImg}
              alt="Hồng Phúc Glass Logo"
              width={768}
              height={295}
              fetchPriority="high"
              decoding="async"
              className="h-8 w-auto object-contain"
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-black text-red-400 tracking-wider uppercase leading-tight">
              HỒNG PHÚC GLASS
            </span>
            <span className="text-[10px] text-amber-200/90 font-extrabold tracking-wide">
              Vòng Quay May Mắn Tri Ân
            </span>
          </div>
        </div>

        <div className="px-2.5 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-300 font-extrabold text-[10px] uppercase tracking-wider shadow-sm">
          Chính Hãng
        </div>
      </div>
    </header>
  );
}
