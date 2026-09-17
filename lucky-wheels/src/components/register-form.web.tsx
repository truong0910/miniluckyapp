import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PATHS } from "@/constants/path";
import { participantService } from "@/services/participant.services";

export default function WebRegisterForm() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    participantService.getCurrent().then((participant) => {
      if (active && participant) navigate(PATHS.WHEEL, { replace: true });
    }).catch(() => {
      if (active) participantService.clearSession();
    });
    return () => { active = false; };
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      await participantService.authenticate(phone);
      navigate(PATHS.WHEEL);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể kiểm tra số điện thoại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="relative overflow-hidden space-y-5 rounded-3xl border border-amber-200/60 bg-white/95 p-6 text-slate-900 shadow-2xl">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
      <div className="space-y-1">
        <h2 className="text-xl font-black">Tham gia vòng quay</h2>
        <p className="text-sm text-slate-600">Nhập số điện thoại đã đăng ký để kiểm tra lượt quay.</p>
      </div>

      <label className="block space-y-2 text-sm font-bold" htmlFor="participant-phone">
        Số điện thoại
        <input
          id="participant-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          maxLength={16}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Ví dụ: 0901234567"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold outline-none focus:border-amber-500"
          disabled={isSubmitting}
        />
      </label>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || !phone.trim()}
        className="h-12 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 font-black text-white shadow-lg transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "ĐANG KIỂM TRA..." : "TIẾP TỤC"}
      </button>
    </form>
  );
}
