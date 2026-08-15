import VoucherImg from "@/static/voucher.png";

function formatExpiration(expiresAt?: string) {
  if (!expiresAt) return "Hạn sử dụng: Theo điều kiện chương trình";
  const [year, month, day] = expiresAt.split("-");
  return day && month && year ? `HSD đến hết ngày ${day}/${month}/${year}` : expiresAt;
}

export default function VoucherCard({
  title,
  expiresAt,
}: {
  title: string;
  expiresAt?: string;
}) {
  return (
    <div className="relative w-full rounded-3xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 p-4 text-slate-950 shadow-[0_15px_35px_rgba(245,158,11,0.4)] border-2 border-yellow-200 overflow-hidden shine-sweep-container">
      {/* Side Ticket Circular Notches */}
      <div className="ticket-notch-left shadow-inner" />
      <div className="ticket-notch-right shadow-inner" />

      <div className="flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-950/10 grid place-items-center border border-yellow-100/40 shrink-0">
            <img src={VoucherImg} alt="Voucher" className="w-10 h-10 object-contain drop-shadow-md" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-900/70">
              VOUCHER TRÚNG THƯỞNG
            </div>
            <div className="text-base font-black text-slate-950 leading-tight">
              {title}
            </div>
            <div className="text-[11px] font-bold text-slate-800/80 mt-0.5">
              {formatExpiration(expiresAt)}
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <div className="px-3.5 py-2 rounded-2xl bg-slate-950 text-amber-300 font-extrabold text-xs shadow-md border border-amber-400/40">
            ĐÃ NHẬN
          </div>
        </div>
      </div>

      {/* Ticket Dashed Separator Line */}
      <div className="mt-3 pt-2.5 border-t border-dashed border-slate-950/30 flex items-center justify-between text-[10px] font-bold text-slate-900/80 px-2">
        <span>MÃ VOUCHER ĐÃ ĐƯỢC LƯU</span>
        <span>HỆ THỐNG ZALO ZNS ⚡</span>
      </div>
    </div>
  );
}
