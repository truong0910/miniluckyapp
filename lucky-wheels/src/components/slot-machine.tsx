import { PATHS } from "@/constants/path";
import { oaService } from "@/services/oa.services";
import {
  participantService,
  type Participant,
} from "@/services/participant.services";
import { spinService, type SpinResponse } from "@/services/spin.services";
import { zbsService } from "@/services/zbs.services";
import { getWheelLoadState } from "@/services/wheel-load-state";
import { useEffect, useMemo, useState } from "react";
import { Button, useNavigate } from "zmp-ui";
import VoucherCard from "./voucher-card";

const SPIN_DURATION_MS = 4500;

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));

// 5 curated vibrant gradients so adjacent slices never clash
const SLICE_GRADIENTS = [
  { id: "sliceGrad0", from: "#dc2626", to: "#991b1b", labelColor: "#fef08a" }, // Crimson Red
  { id: "sliceGrad1", from: "#f59e0b", to: "#b45309", labelColor: "#ffffff" }, // Royal Gold
  { id: "sliceGrad2", from: "#e11d48", to: "#881337", labelColor: "#fef08a" }, // Ruby Red
  { id: "sliceGrad3", from: "#d97706", to: "#78350f", labelColor: "#ffffff" }, // Amber Gold
  { id: "sliceGrad4", from: "#059669", to: "#064e3b", labelColor: "#ffffff" }, // Emerald Jade
];

export default function SlotMachine() {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isLoadingParticipant, setIsLoadingParticipant] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [activeSpinResult, setActiveSpinResult] = useState<SpinResponse | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    participantService
      .getCurrent()
      .then((customer) => {
        if (cancelled) return;
        setParticipant(customer);
        if (!customer) {
          setSpinError("Vui lòng tra cứu thông tin trước khi quay.");
        }
      })
      .catch((error) => {
        console.error("Unable to load wheel", error);
        if (!cancelled) setSpinError("Không thể tải thông tin vòng quay.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingParticipant(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const segments = participant?.wheelSegments || [];
  const count = Math.max(1, segments.length);
  const segmentAngle = 360 / count;

  // Pre-calculate SVG Slice Paths & Content Coordinates
  const svgSlices = useMemo(() => {
    const radius = 190;
    const cx = 200;
    const cy = 200;

    return segments.map((seg, i) => {
      const alpha1 = i * segmentAngle - segmentAngle / 2;
      const alpha2 = (i + 1) * segmentAngle - segmentAngle / 2;
      const midAlpha = i * segmentAngle;

      const rad1 = (alpha1 * Math.PI) / 180;
      const rad2 = (alpha2 * Math.PI) / 180;
      const midRad = (midAlpha * Math.PI) / 180;

      const x1 = cx + radius * Math.sin(rad1);
      const y1 = cy - radius * Math.cos(rad1);
      const x2 = cx + radius * Math.sin(rad2);
      const y2 = cy - radius * Math.cos(rad2);

      const largeArc = segmentAngle > 180 ? 1 : 0;
      const pathD = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

      const textR = 125;
      const tx = cx + textR * Math.sin(midRad);
      const ty = cy - textR * Math.cos(midRad);

      const grad = SLICE_GRADIENTS[i % SLICE_GRADIENTS.length];

      return {
        ...seg,
        index: i,
        pathD,
        midAlpha,
        tx,
        ty,
        grad,
      };
    });
  }, [segments, segmentAngle]);

  const handleSendZns = async (result: SpinResponse, customer: Participant) => {
    if (result.outcome !== "reward" || !result.reward) return;

    if (!zbsService.isConfigured()) {
      setDeliveryStatus("failed");
      setDeliveryMessage("Voucher đã lưu vào tài khoản (Chưa cấu hình ZBS gửi tin ZNS).");
      return;
    }

    setDeliveryStatus("sending");
    setDeliveryMessage("Đang gửi Voucher qua tin nhắn Zalo...");
    try {
      const delivery = await zbsService.sendWinnerVoucher(result, customer);
      setDeliveryStatus(delivery.status === "sent" ? "sent" : "sending");
      setDeliveryMessage("Voucher đã được gửi thành công về Zalo của bạn!");
    } catch (error) {
      setDeliveryStatus("failed");
      setDeliveryMessage(
        error instanceof Error ? error.message : "Không thể gửi tin nhắn Zalo lúc này."
      );
    }
  };

  const spin = async () => {
    if (isSpinning) return;

    if (!oaService.isFollowed()) {
      setSpinError("Vui lòng theo dõi Official Account trước khi quay.");
      return;
    }

    if (!participantService.getToken() || !participant) {
      setSpinError("Vui lòng tra cứu khách hàng trước khi quay.");
      return;
    }
    if (participant.spinsRemaining < 1) {
      setSpinError("Bạn đã hết lượt quay.");
      return;
    }

    setIsSpinning(true);
    setSpinError(null);
    setShowResultModal(false);

    try {
      const result = await spinService.spin();
      const targetIndex = segments.findIndex(
        (segment) => segment.id === result.wheelSegmentId
      );
      if (targetIndex < 0) {
        throw new Error("Kết quả quay không khớp cấu hình vòng quay.");
      }

      const currentModulo = ((rotation % 360) + 360) % 360;
      const targetModulo = ((-targetIndex * segmentAngle) % 360 + 360) % 360;
      const delta = ((targetModulo - currentModulo + 360) % 360) + 6 * 360;
      setRotation(rotation + delta);

      await wait(SPIN_DURATION_MS + 100);

      const updatedParticipant = {
        ...participant,
        spinsRemaining: result.spinsRemaining,
      };
      participantService.updateCached({ spinsRemaining: result.spinsRemaining });
      setParticipant(updatedParticipant);
      setActiveSpinResult(result);
      setIsSpinning(false);

      // Trigger ZNS delivery in background if won
      void handleSendZns(result, updatedParticipant);

      // Open Modal on current page
      setShowResultModal(true);
    } catch (error) {
      console.error("Unable to spin", error);
      setIsSpinning(false);
      setSpinError(
        error instanceof Error
          ? error.message
          : "Không thể quay lúc này. Vui lòng thử lại."
      );
    }
  };

  const wheelState = getWheelLoadState({
    isLoading: isLoadingParticipant,
    participant,
    segmentCount: segments.length,
    error: spinError,
  });

  if (wheelState === "loading") {
    return (
      <div role="status" className="w-full flex flex-col items-center justify-center py-12 gap-3 text-red-200">
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="font-extrabold text-sm tracking-wide">Đang tải thông tin vòng quay...</span>
      </div>
    );
  }

  if (wheelState === "error" || wheelState === "empty") {
    return (
      <div role="alert" className="w-[min(88vw,360px)] mx-auto my-6 p-6 rounded-2xl bg-slate-900/90 border border-red-500/30 text-center shadow-xl">
        <p className="text-sm font-bold text-red-300 leading-relaxed mb-4">
          {spinError || "Chưa có thông tin vòng quay."}
        </p>
        <Button
          size="medium"
          className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
          onClick={() => navigate(PATHS.REGISTER)}
        >
          Đăng ký / Xác minh Zalo
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-5 py-2 relative z-20">
      {/* 100% RESPONSIVE CIRCULAR WHEEL CONTAINER */}
      <div className="relative aspect-square w-[min(84vw,340px)] h-[min(84vw,340px)] rounded-full bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-800 shadow-[0_15px_45px_rgba(245,158,11,0.7)] border-4 border-amber-200 flex items-center justify-center shrink-0 mx-auto">
        
        {/* 12 Animated Pulsing LED Bulbs along Rim */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 360) / 12;
          return (
            <div
              key={i}
              className="absolute w-3.5 h-3.5 rounded-full bg-yellow-200 border border-amber-800 shadow-[0_0_10px_#fde047] z-30 animate-pulse-light pointer-events-none"
              style={{
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-154px)`,
                animationDelay: `${(i % 3) * 0.35}s`,
              }}
            />
          );
        })}

        {/* 3D Gold Metallic Top Needle Pointer */}
        <div
          className="absolute left-1/2 -top-5 -translate-x-1/2 z-40 pointer-events-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.7)]"
        >
          <div className="w-8 h-10 bg-gradient-to-b from-amber-100 via-yellow-400 to-amber-600 [clip-path:polygon(50%_100%,0%_0%,100%_0%)]" />
        </div>

        {/* ROTATING SVG WHEEL DISK */}
        <div
          className="relative aspect-square w-[89%] h-[89%] rounded-full border-4 border-amber-200 shadow-2xl overflow-hidden shrink-0"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.15, 0.85, 0.15, 1)`
              : "none",
          }}
        >
          <svg viewBox="0 0 400 400" className="w-full h-full block">
            <defs>
              {SLICE_GRADIENTS.map((g) => (
                <radialGradient
                  key={g.id}
                  id={g.id}
                  cx="50%"
                  cy="50%"
                  r="75%"
                  fx="50%"
                  fy="50%"
                >
                  <stop offset="0%" stopColor={g.from} />
                  <stop offset="100%" stopColor={g.to} />
                </radialGradient>
              ))}

              {/* Glossy Overlay Gradient */}
              <linearGradient id="glossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Render SVG Slice Arcs */}
            {svgSlices.map((slice) => (
              <path
                key={slice.id}
                d={slice.pathD}
                fill={`url(#${slice.grad.id})`}
                stroke="#fef08a"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            ))}

            {/* Render Glossy Overlay */}
            <circle cx="200" cy="200" r="190" fill="url(#glossGrad)" pointerEvents="none" />

            {/* Render Radial Slice Text & Icons */}
            {svgSlices.map((slice) => {
              const isGoldReward = slice.type === "reward";
              return (
                <g
                  key={`content-${slice.id}`}
                  transform={`translate(${slice.tx.toFixed(2)}, ${slice.ty.toFixed(2)}) rotate(${slice.midAlpha.toFixed(2)})`}
                  pointerEvents="none"
                >
                  <text
                    x="0"
                    y="-12"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="22"
                    className="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  >
                    {isGoldReward ? "🎁" : "🍀"}
                  </text>

                  <text
                    x="0"
                    y="14"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={slice.grad.labelColor}
                    fontWeight="900"
                    fontSize="13"
                    letterSpacing="0.5"
                    className="font-black uppercase filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                  >
                    {slice.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* CENTER 3D SPIN BUTTON - DEAD CENTER */}
        <button
          type="button"
          onClick={spin}
          disabled={isSpinning || segments.length === 0}
          className="!absolute !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 z-30 flex flex-col items-center justify-center w-20 h-20 rounded-full border-4 border-yellow-200 bg-gradient-to-b from-red-500 via-red-600 to-amber-700 text-white font-black text-lg tracking-wider uppercase shadow-[0_10px_25px_rgba(220,38,38,0.8)] active:scale-95 transition-transform disabled:opacity-80 shine-sweep-container shrink-0"
        >
          <span className="drop-shadow-md leading-tight text-center">
            {isSpinning ? "ĐANG\nQUAY" : "QUAY"}
          </span>
        </button>
      </div>

      {/* SPINS REMAINING BADGE */}
      <div className="px-5 py-2 rounded-full bg-slate-900/85 backdrop-blur-md border border-amber-400/50 shadow-xl flex items-center gap-2">
        <span className="text-base">⭐</span>
        <span className="text-xs font-bold text-white">
          Bạn còn{" "}
          <span className="text-amber-400 font-black text-sm">
            {participant?.spinsRemaining ?? 0}
          </span>{" "}
          lượt quay
        </span>
      </div>

      {/* ERROR DISPLAY */}
      {spinError && (
        <p className="max-w-xs rounded-xl bg-rose-900/90 text-rose-100 border border-rose-500 px-4 py-2 text-xs text-center font-semibold shadow-lg" role="alert">
          ⚠️ {spinError}
        </p>
      )}

      {/* CELEBRATORY RESULT MODAL POPUP (NO PAGE REDIRECT) */}
      {showResultModal && activeSpinResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card-dark rounded-3xl p-6 border-2 border-amber-400/60 shadow-[0_25px_60px_rgba(0,0,0,0.8)] max-w-sm w-full text-center relative overflow-hidden flex flex-col items-center gap-4">
            
            {/* Top Amber Light Bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />

            {/* MODAL HEADER */}
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-widest font-extrabold text-amber-400">
                KẾT QUẢ LƯỢT QUAY
              </div>
              <h2 className="text-2xl font-black text-gold-gradient">
                {activeSpinResult.outcome === "reward"
                  ? "🎉 CHÚC MỪNG BẠN!"
                  : "🍀 MAY MẮN LẦN SAU!"}
              </h2>
            </div>

            {/* REWARD OR CLOVER DISPLAY */}
            {activeSpinResult.outcome === "reward" && activeSpinResult.reward ? (
              <div className="w-full">
                <VoucherCard
                  title={activeSpinResult.reward.title}
                  expiresAt={activeSpinResult.reward.expiresAt}
                />

                {/* ZNS DELIVERY STATUS */}
                {deliveryStatus !== "idle" && (
                  <div
                    role="status"
                    className={`mt-3 w-full rounded-xl px-3 py-2 text-center text-[11px] font-bold border ${
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
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500/20 to-red-500/20 border border-amber-400/40 grid place-items-center text-5xl shadow-xl my-2">
                🍀
              </div>
            )}

            <p className="text-xs text-slate-300">
              {activeSpinResult.outcome === "reward"
                ? "Mã Voucher đã được lưu vào tài khoản của bạn."
                : "Hãy thử vận may ở lượt quay tiếp theo nhé!"}
            </p>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col gap-2.5 w-full mt-2">
              {activeSpinResult.spinsRemaining > 0 ? (
                <Button
                  className="!w-full !h-12 !bg-gradient-to-r !from-amber-500 !via-red-600 !to-amber-600 hover:!from-amber-400 hover:!to-red-500 !text-white !font-black !text-sm !rounded-2xl !shadow-xl !shadow-red-600/30 active:scale-95 transition-transform shine-sweep-container"
                  fullWidth
                  onClick={() => setShowResultModal(false)}
                >
                  🎰 QUAY TIẾP (CÒN {activeSpinResult.spinsRemaining} LƯỢT)
                </Button>
              ) : (
                <Button
                  className="!w-full !h-12 !bg-gradient-to-r !from-slate-700 !to-slate-800 !text-amber-300 !font-black !text-sm !rounded-2xl border border-amber-500/30"
                  fullWidth
                  onClick={() => setShowResultModal(false)}
                >
                  BẠN ĐÃ DÙNG HẾT LƯỢT QUAY
                </Button>
              )}

              <Button
                htmlType="button"
                variant="tertiary"
                className="!text-amber-300 !text-xs !font-bold"
                fullWidth
                onClick={() => navigate(PATHS.VOUCHER)}
              >
                🎟️ Xem danh sách Voucher & Lịch sử quay
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
