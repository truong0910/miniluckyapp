import Background from "@/components/background";
import Header from "@/components/header";
import VoucherCard from "@/components/voucher-card";
import { PATHS } from "@/constants/path";
import {
  awardService,
  type ParticipantAward,
} from "@/services/award.services";
import {
  participantService,
  type Participant,
} from "@/services/participant.services";
import { spinService, type SpinResponse } from "@/services/spin.services";
import {
  ZbsDeliveryError,
  zbsService,
} from "@/services/zbs.services";
import VoucherRibbonImg from "@/static/voucher-ribbon.webp";
import { useCallback, useEffect, useState } from "react";
import { Button, Page, useNavigate } from "zmp-ui";

type DeliveryStatus =
  | "idle"
  | "sending"
  | "sent"
  | "failed"
  | "not_configured";

export default function VoucherPage() {
  const navigate = useNavigate();
  const spinResult = spinService.getLastSpin();

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [spinHistory, setSpinHistory] = useState<SpinResponse[]>([]);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>("idle");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [deliveryAttempt, setDeliveryAttempt] = useState(0);

  // Awards API state
  const [awards, setAwards] = useState<ParticipantAward[]>([]);

  const latestAward = awards.length > 0 ? awards[0] : null;
  const reward = spinResult?.outcome === "reward" && spinResult.reward
    ? spinResult.reward
    : (latestAward ? { title: latestAward.title, expiresAt: latestAward.expiresAt ?? undefined, description: latestAward.description ?? undefined } : null);
  const isWinner = Boolean(reward);
  const [awardsLoading, setAwardsLoading] = useState(true);
  const [awardsLoadingMore, setAwardsLoadingMore] = useState(false);
  const [awardsError, setAwardsError] = useState<string | null>(null);
  const [awardsPage, setAwardsPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadAwards = useCallback(async (pageToLoad = 1, append = false) => {
    if (append) {
      setAwardsLoadingMore(true);
    } else {
      setAwardsLoading(true);
    }
    setAwardsError(null);

    try {
      const res = await awardService.getParticipantAwards(pageToLoad, 10);
      setAwards((prev) => (append ? [...prev, ...res.items] : res.items));
      setHasMore(res.hasMore);
      setAwardsPage(res.page);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Không thể tải kho voucher từ hệ thống.";
      setAwardsError(msg);
    } finally {
      setAwardsLoading(false);
      setAwardsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const loadCustomerData = async () => {
      try {
        const customer = await participantService.getCurrent();
        setParticipant(customer);
        if (customer) {
          const history = await spinService.fetchSpinHistory();
          setSpinHistory(history);
        }
      } catch (error) {
        console.error("Unable to load history", error);
      }
    };

    void loadCustomerData();
    void loadAwards(1, false);
  }, [loadAwards]);

  useEffect(() => {
    if (!spinResult || !reward) return;

    const delivered = zbsService.getDelivery(spinResult.spinId);
    if (delivered?.status === "sent") {
      setDeliveryStatus("sent");
      setDeliveryMessage("Voucher đã được gửi thành công về Zalo của bạn!");
      return;
    }

    if (!zbsService.isConfigured()) {
      setDeliveryStatus("not_configured");
      setDeliveryMessage(
        "Voucher đã được ghi nhận vào tài khoản của bạn (Chưa cấu hình ZBS gửi tin ZNS)."
      );
      return;
    }

    let cancelled = false;

    const sendVoucher = async () => {
      setDeliveryStatus("sending");
      setDeliveryMessage("Đang gửi Voucher qua tin nhắn Zalo...");

      try {
        const customer = await participantService.getCurrent();
        if (!customer) {
          throw new Error("Không tìm thấy thông tin khách hàng nhận voucher.");
        }

        await zbsService.sendWinnerVoucher(spinResult, customer);
        if (cancelled) return;

        setDeliveryStatus("sent");
        setDeliveryMessage("Voucher đã được gửi thành công về Zalo của bạn!");
      } catch (error) {
        if (cancelled) return;

        const isMissingConfig =
          error instanceof ZbsDeliveryError &&
          error.reason === "not_configured";
        setDeliveryStatus(isMissingConfig ? "not_configured" : "failed");
        setDeliveryMessage(
          error instanceof Error
            ? error.message
            : "Không thể gửi voucher về Zalo lúc này."
        );
      }
    };

    void sendVoucher();
    return () => {
      cancelled = true;
    };
  }, [spinResult?.spinId, deliveryAttempt]);

  const spinsRemaining = participant?.spinsRemaining ?? (spinResult?.spinsRemaining ?? 0);

  return (
    <Page
      hideScrollbar
      className="relative overflow-y-scroll overflow-x-hidden bg-slate-950 min-h-screen pb-24"
    >
      <Background />
      <Header />

      <div className="relative max-w-md mx-auto px-4 z-10 space-y-5 mt-4">
        {/* CELEBRATION HEADER CARD */}
        <div className="glass-card-dark p-6 rounded-3xl border border-amber-500/30 shadow-2xl flex flex-col items-center text-center gap-4 relative overflow-hidden">
          <img
            src={VoucherRibbonImg}
            alt=""
            width={840}
            height={560}
            decoding="async"
            className="absolute top-0 inset-x-0 w-full h-32 object-cover opacity-25 pointer-events-none"
          />

          <div className="space-y-1 relative z-10">
            <div className="text-xs uppercase tracking-widest font-extrabold text-amber-400">
              KẾT QUẢ VÀ KHO VOUCHER
            </div>
            <h1 className="text-3xl font-black text-gold-gradient">
              {isWinner ? "🎉 CHÚC MỪNG BẠN!" : "🍀 MAY MẮN LẦN SAU!"}
            </h1>
            <p className="text-xs text-slate-300 font-medium max-w-xs mx-auto">
              {isWinner
                ? "Bạn đã xuất sắc trúng phần thưởng từ chương trình Vòng Quay May Mắn"
                : "Lượt này chưa trúng phần thưởng. Đừng nản lòng, hãy thử lại ở lượt quay tiếp theo nhé!"}
            </p>
          </div>

          {/* REWARD OR CLOVER */}
          {reward ? (
            <VoucherCard title={reward.title} expiresAt={reward.expiresAt} />
          ) : (
            <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-amber-500/20 to-red-500/20 border border-amber-400/40 grid place-items-center text-5xl shadow-xl animate-bounce">
              🍀
            </div>
          )}

          {/* REWARD DESCRIPTION */}
          <div className="text-xs text-amber-200/90 bg-amber-950/40 p-3 rounded-2xl border border-amber-500/20 w-full">
            {reward
              ? reward.description || "Vui lòng kiểm tra tin nhắn Zalo để nhận hướng dẫn đổi Voucher."
              : "Chúc bạn sẽ nhận được phần thưởng giá trị ở lượt quay tiếp theo."}
          </div>

          {/* ZNS DELIVERY STATUS */}
          {reward && deliveryStatus !== "idle" && (
            <div
              role="status"
              className={`w-full rounded-2xl px-4 py-2.5 text-center text-xs font-bold border ${
                deliveryStatus === "sent"
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                  : deliveryStatus === "sending"
                  ? "bg-blue-950/80 text-blue-300 border-blue-500/40 animate-pulse"
                  : "bg-amber-950/80 text-amber-300 border-amber-500/40"
              }`}
            >
              {deliveryStatus === "sent" ? "✅ " : deliveryStatus === "sending" ? "⚡ " : "ℹ️ "}
              {deliveryMessage}
            </div>
          )}

          {/* RETRY BUTTON */}
          {reward && deliveryStatus === "failed" && (
            <Button
              htmlType="button"
              className="!bg-gradient-to-r !from-amber-500 !to-red-600 !text-white !font-bold text-xs"
              fullWidth
              onClick={() => setDeliveryAttempt((value) => value + 1)}
            >
              GỬI LẠI VOUCHER QUA ZALO
            </Button>
          )}
        </div>

        {/* SECTION 1: KHO VOUCHER ĐÃ TÍCH LŨY (API AWARDS HISTORY) */}
        <div className="space-y-3">
          <h2 className="text-xs font-extrabold text-gold-gradient uppercase tracking-wider px-1">
            🎁 Kho Voucher đã tích lũy ({awards.length})
          </h2>

          {/* LOADING STATE */}
          {awardsLoading && awards.length === 0 && (
            <div
              role="status"
              aria-label="Loading awards"
              className="glass-card-dark p-6 rounded-3xl border border-amber-500/20 text-center text-amber-300/80 text-xs font-semibold animate-pulse"
            >
              ⏳ Đang tải danh sách kho voucher...
            </div>
          )}

          {/* ERROR STATE */}
          {awardsError && (
            <div
              role="alert"
              className="glass-card-dark p-4 rounded-3xl border border-red-500/40 bg-red-950/40 text-center space-y-2"
            >
              <div className="text-xs font-bold text-red-300">
                ⚠️ {awardsError}
              </div>
              <Button
                htmlType="button"
                className="!bg-red-600 hover:!bg-red-500 !text-white !font-bold text-xs !py-1 !px-4 !rounded-xl"
                onClick={() => void loadAwards(1, false)}
              >
                Thử lại
              </Button>
            </div>
          )}

          {/* EMPTY STATE */}
          {!awardsLoading && !awardsError && awards.length === 0 && (
            <div
              role="region"
              aria-label="Empty awards"
              className="glass-card-dark p-6 rounded-3xl border border-slate-800 text-center text-slate-400 text-xs font-medium space-y-1"
            >
              <div className="text-2xl mb-1">🎁</div>
              <div>Bạn chưa có voucher nào trong kho.</div>
              <div className="text-[11px] text-slate-500">
                Hãy thực hiện lượt quay may mắn để tích lũy voucher!
              </div>
            </div>
          )}

          {/* AWARDS LIST & PAGINATION */}
          {awards.length > 0 && (
            <div className="space-y-3">
              {awards.map((award) => (
                <div key={award.id} className="space-y-1">
                  <VoucherCard
                    title={award.title}
                    expiresAt={award.expiresAt || undefined}
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-2">
                    <span>Mã: <strong className="text-amber-300 font-mono">{award.code}</strong></span>
                    <span className="capitalize">Trạng thái: <strong className="text-amber-400">{award.status}</strong></span>
                  </div>
                </div>
              ))}

              {/* PAGINATION LOAD MORE BUTTON */}
              {hasMore && (
                <div className="pt-1 text-center">
                  <Button
                    htmlType="button"
                    variant="secondary"
                    disabled={awardsLoadingMore}
                    className="!bg-slate-900/80 hover:!bg-slate-800 !text-amber-300 border border-amber-500/30 !font-bold text-xs !w-full !rounded-2xl !py-2.5"
                    onClick={() => void loadAwards(awardsPage + 1, true)}
                  >
                    {awardsLoadingMore ? "Đang tải..." : "Xem thêm voucher ▼"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: NHẬT KÝ TẤT CẢ LƯỢT QUAY */}
        {spinHistory.length > 0 && (
          <div className="glass-card-dark p-4 rounded-3xl border border-amber-500/20 space-y-3">
            <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
              📜 Lịch sử các lượt đã quay ({spinHistory.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {spinHistory.map((spin, idx) => (
                <div
                  key={spin.spinId || idx}
                  className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl text-xs border border-slate-800/80"
                >
                  <div className="flex items-center gap-2">
                    <span>{spin.outcome === "reward" ? "🎁" : "🍀"}</span>
                    <span className="font-bold text-slate-200">
                      Lượt {spinHistory.length - idx}:{" "}
                      {spin.outcome === "reward" && spin.reward
                        ? spin.reward.title
                        : "Chúc bạn may mắn"}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      spin.outcome === "reward"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {spin.outcome === "reward" ? "TRÚNG" : "MAY MẮN"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BUTTONS */}
        <div className="space-y-2 pt-1">
          {spinsRemaining > 0 ? (
            <Button
              htmlType="button"
              className="!w-full !h-13 !bg-gradient-to-r !from-amber-500 !via-red-600 !to-amber-600 hover:!from-amber-400 hover:!to-red-500 !text-white !font-black !text-base !rounded-2xl !shadow-xl !shadow-red-600/30 active:scale-95 transition-transform shine-sweep-container"
              fullWidth
              onClick={() => navigate(PATHS.WHEEL)}
            >
              🎰 TIẾP TỤC QUAY ({spinsRemaining} LƯỢT CÒN LẠI)
            </Button>
          ) : (
            <Button
              htmlType="button"
              className="!w-full !h-12 !bg-gradient-to-r !from-slate-800 !to-slate-900 !text-slate-400 !font-bold !text-xs !rounded-2xl border border-slate-700"
              fullWidth
              disabled
            >
              BẠN ĐÃ HOÀN THÀNH TẤT CẢ LƯỢT QUAY
            </Button>
          )}

          <Button
            htmlType="button"
            variant="tertiary"
            className="!text-slate-400 !text-xs !font-semibold"
            fullWidth
            onClick={() => navigate(PATHS.HOME)}
          >
            🏠 Quay lại trang chủ
          </Button>
        </div>
      </div>
    </Page>
  );
}
