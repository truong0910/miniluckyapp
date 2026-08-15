import Background from "@/components/background";
import Header from "@/components/header";
import { PATHS } from "@/constants/path";
import {
  participantService,
  type Participant,
} from "@/services/participant.services";
import rewardImg from "@/static/reward.webp";
import { useEffect, useState } from "react";
import { Button, Page, useNavigate } from "zmp-ui";

export default function RewardPage() {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadParticipant = async () => {
      try {
        setParticipant(await participantService.getCurrent());
      } catch (error) {
        console.error("Unable to load customer", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadParticipant();
  }, []);

  const spinsRemaining = participant?.spinsRemaining || 0;

  return (
    <Page
      hideScrollbar
      className="relative overflow-y-scroll overflow-x-hidden bg-slate-950 min-h-screen pb-20"
    >
      <Background />
      <div className="relative max-w-md mx-auto z-10">
        <Header />

        <div className="mx-4 flex flex-col items-center justify-center mt-6">
          <div className="glass-card-dark p-6 rounded-3xl border border-amber-500/30 shadow-2xl w-full flex flex-col items-center gap-5 text-center relative overflow-hidden">
            {/* Top Amber Accent Glow */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />

            <div className="w-48 h-48 rounded-full bg-gradient-to-tr from-amber-500/20 to-red-500/20 p-2 border border-amber-400/30 flex items-center justify-center animate-float">
              <img
                src={rewardImg}
                alt="Voucher Reward"
                width={512}
                height={239}
                decoding="async"
                className="w-40 h-40 object-contain drop-shadow-[0_10px_20px_rgba(245,158,11,0.4)]"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest font-extrabold text-amber-400">
                Sẵn sàng thử vận may
              </div>
              <h2 className="text-2xl font-black text-gold-gradient">
                {isLoading
                  ? "Đang kiểm tra lượt quay..."
                  : `Bạn có ${spinsRemaining} lượt quay quà`}
              </h2>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
              {participant
                ? `Chào ${participant.name}! Số lượt quay và danh sách giải thưởng của bạn đã sẵn sàng.`
                : "Không tìm thấy thông tin khách hàng. Vui lòng quay lại trang đăng ký để kiểm tra số điện thoại."}
            </p>

            <Button
              className="!w-full !h-13 !bg-gradient-to-r !from-amber-500 !via-red-600 !to-amber-600 hover:!from-amber-400 hover:!to-red-500 !text-white !font-black !text-base !rounded-2xl !shadow-xl !shadow-red-600/30 active:scale-95 transition-transform shine-sweep-container"
              fullWidth
              disabled={isLoading || spinsRemaining < 1}
              onClick={() => navigate(PATHS.WHEEL)}
            >
              ĐẾN VÒNG QUAY MAY MẮN 🎰
            </Button>
          </div>
        </div>
      </div>
    </Page>
  );
}
