import { useEffect, useState } from "react";
import { useNavigate, useSnackbar } from "zmp-ui";
import { PATHS } from "@/constants/path";
import { participantService } from "@/services/participant.services";

export default function MiniAppRegisterForm() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    let active = true;
    participantService.getCurrent().then((participant) => {
      if (active && participant) navigate(PATHS.WHEEL, { replace: true });
    }).catch((error) => {
      console.error("Unable to restore Mini App participant session", error);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [navigate]);

  async function continueWithZalo() {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      const participant = await participantService.authenticate();
      openSnackbar({ icon: true, type: "success", text: `Xin chào ${participant.name || participant.phone}!`, duration: 3000 });
      navigate(PATHS.WHEEL);
    } catch (error) {
      openSnackbar({ icon: true, type: "error", text: error instanceof Error ? error.message : "Không thể xác minh số điện thoại Zalo.", duration: 4000 });
    } finally {
      setIsAuthenticating(false);
    }
  }

  return (
    <section className="relative overflow-hidden space-y-5 rounded-3xl border border-amber-200/60 bg-white/95 p-6 text-slate-900 shadow-2xl">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
      <div className="space-y-1">
        <h2 className="text-xl font-black">Tham gia vòng quay</h2>
        <p className="text-sm text-slate-600">Cho phép Mini App xác minh số điện thoại bằng Zalo để tìm lượt quay của bạn.</p>
      </div>
      <button
        type="button"
        onClick={() => void continueWithZalo()}
        disabled={isLoading || isAuthenticating}
        className="h-12 w-full rounded-2xl bg-gradient-to-r from-red-500 via-red-600 to-amber-600 font-black text-white shadow-lg transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60"
      >
        {isLoading ? "ĐANG TẢI..." : isAuthenticating ? "ĐANG XÁC MINH..." : "XÁC MINH BẰNG ZALO"}
      </button>
    </section>
  );
}
