import { PATHS } from "@/constants/path";
import {
  participantService,
  type Participant,
} from "@/services/participant.services";
import { oaService } from "@/services/oa.services";
import { permissionService } from "@/services/permission.services";
import { useEffect, useState } from "react";
import { getAccessToken, showOAWidget } from "zmp-sdk/apis";
import { Button, useNavigate, useSnackbar } from "zmp-ui";
import Divider from "./divider";

export default function RegisterForm() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [customer, setCustomer] = useState<Participant | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [hasFollowedOA, setHasFollowedOA] = useState(oaService.isFollowed());
  const [oaWidgetError, setOaWidgetError] = useState<string | null>(null);
  const [showMockButton, setShowMockButton] = useState(false);
  const [isFetchingPhone, setIsFetchingPhone] = useState(false);
  const [previewPhone, setPreviewPhone] = useState("");
  const [isPreviewLookup, setIsPreviewLookup] = useState(false);
  const [zaloAvatar, setZaloAvatar] = useState<string | null>(null);


  useEffect(() => {
    let cancelled = false;

    // Fetch Zalo User Avatar & Profile from SDK
    permissionService.getUserProfile().then((profile) => {
      if (cancelled) return;
      if (profile?.avatar) {
        setZaloAvatar(profile.avatar);
      }
    });

    const loadProfile = async () => {
      try {
        const currentCustomer = await participantService.getCurrent();
        if (cancelled) return;
        if (currentCustomer) {
          setCustomer(currentCustomer);
        }
      } catch (error) {
        console.error("Unable to load profile", error);
      } finally {
        if (!cancelled) setIsLoadingProfile(false);
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const oaId = import.meta.env.VITE_ZALO_OA_ID?.trim();

    showOAWidget({
      id: "registrationOaWidget",
      ...(oaId ? { oaId } : {}),
      guidingText: "Theo dõi OA để nhận voucher khi trúng thưởng",
      color: "#0068FF",
      onStatusChange: (status) => {
        if (cancelled) return;
        const followed = oaService.updateFromWidgetStatus(status);
        setHasFollowedOA(followed);
        setOaWidgetError(null);
      },
      onError: () => {
        if (cancelled) return;
        setOaWidgetError(
          "Không thể tải nút theo dõi OA thật của Zalo (Môi trường Web / Dev Local)."
        );
        setShowMockButton(true);
      },
    }).catch(() => {
      if (cancelled) return;
      setOaWidgetError(
        "Không thể tải nút theo dõi OA thật của Zalo (Môi trường Web / Dev Local)."
      );
      setShowMockButton(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleMockFollow = () => {
    const nextState = !hasFollowedOA;
    setHasFollowedOA(nextState);
    oaService.setFollowed(nextState);
  };

  const handlePreviewLookup = async () => {
    const phone = previewPhone.trim();
    if (!phone) {
      openSnackbar({ icon: true, type: "warning", text: "Vui lòng nhập số điện thoại test.", duration: 3000 });
      return;
    }
    if (!hasFollowedOA) {
      openSnackbar({ icon: true, type: "warning", text: "Vui lòng bật nút giả lập theo dõi OA trước.", duration: 3500 });
      return;
    }

    setIsPreviewLookup(true);
    try {
      const found = await participantService.startPreview(phone);
      setCustomer(found);
      openSnackbar({
        icon: true,
        type: "success",
        text: `Đã vào chế độ test với ${found.name || found.phone}.`,
        duration: 3000,
      });
      navigate(PATHS.WHEEL);
    } catch (error) {
      openSnackbar({
        icon: true,
        type: "error",
        text: error instanceof Error ? error.message : "Không thể tra cứu khách hàng test.",
        duration: 3500,
      });
    } finally {
      setIsPreviewLookup(false);
    }
  };

  const handleGetZaloPhone = async () => {
    if (!hasFollowedOA) {
      openSnackbar({
        icon: true,
        type: "warning",
        text: "Vui lĂ²ng theo dĂµi Official Account trÆ°á»›c khi tiáº¿p tá»¥c.",
        duration: 3500,
      });
      return;
    }

    if (!participantService.isZaloMode()) {
      openSnackbar({
        icon: true,
        type: "warning",
        text: "Luá»“ng xĂ¡c minh Zalo chÆ°a Ä‘Æ°á»£c báº­t trong mĂ´i trÆ°á»ng nĂ y.",
        duration: 4500,
      });
      return;
    }

    setIsFetchingPhone(true);
    try {
      const res = await permissionService.getPhoneNumber();
      if (!res.token) {
        openSnackbar({
          icon: true,
          type: "warning",
          text: res.error || "Zalo chÆ°a tráº£ vá» token sá»‘ Ä‘iá»‡n thoáº¡i.",
          duration: 5000,
        });
        return;
      }

      setCustomer(null);
      const profile = await permissionService.getUserProfile();
      const found = await participantService.startWithZalo(
        await getAccessToken(),
        res.token,
        profile?.name,
      );
      setCustomer(found);

      const displayName = found.name?.trim() || `khĂ¡ch hĂ ng ${found.phone}`;
      openSnackbar({
        icon: true,
        type: "success",
        text: `Xin chĂ o ${displayName}! Báº¡n cĂ³ ${found.spinsRemaining} lÆ°á»£t quay.`,
        duration: 3500,
      });
      navigate(PATHS.WHEEL);
    } catch (error) {
      console.error("Error getting Zalo phone", error);
      openSnackbar({
        icon: true,
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "KhĂ´ng thá»ƒ xĂ¡c minh sá»‘ Ä‘iá»‡n thoáº¡i Zalo lĂºc nĂ y.",
        duration: 3000,
      });
    } finally {
      setIsFetchingPhone(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="bg-white/95 p-8 rounded-3xl border border-slate-200 shadow-2xl text-center text-xs font-bold text-slate-600">
        Đang tải thông tin...
      </div>
    );
  }

  return (
    <div
      className="bg-white/95 p-6 rounded-3xl border border-amber-200/60 shadow-2xl space-y-5 relative overflow-hidden text-slate-900"
    >
      {/* Top Amber Accent Strip */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />

      <div className="space-y-4">
        {/* STEP 1: OFFICIAL ACCOUNT FOLLOW */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-xs grid place-items-center shadow-md">
              01
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                Theo dõi Official Account
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Cần theo dõi OA trước khi tra cứu SĐT và quay thưởng
              </p>
            </div>
          </div>

          <div className="min-h-[50px] rounded-2xl bg-slate-50 p-3 border border-slate-200 flex flex-col items-center justify-center gap-2">
            <div id="registrationOaWidget" className="w-full flex justify-center" />

            {showMockButton && (
              <div className="w-full text-center space-y-2 pt-1 border-t border-slate-200">
                {oaWidgetError && (
                  <p className="text-[11px] text-slate-500 italic">
                    ℹ️ {oaWidgetError}
                  </p>
                )}
                <Button
                  htmlType="button"
                  size="small"
                  onClick={handleToggleMockFollow}
                  className={`!rounded-xl !text-xs !font-bold ${hasFollowedOA
                      ? "!bg-emerald-600 !text-white"
                      : "!bg-amber-500 !text-slate-900"
                    }`}
                >
                  {hasFollowedOA
                    ? "✓ Đã theo dõi OA (Giả lập Test)"
                    : "🔔 Theo dõi OA (Nút Giả lập Test Web)"}
                </Button>
              </div>
            )}
          </div>

          {hasFollowedOA && (
            <div className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <span>✅</span>
              <span>Đã theo dõi OA thành công. Bạn có thể tiếp tục!</span>
            </div>
          )}
        </div>

        <Divider />

        {/* STEP 2: CUSTOMER PHONE LOOKUP */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-xs grid place-items-center shadow-md">
              02
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                Tra cứu danh sách khách hàng
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Nhập SĐT của bạn để nhận lượt quay đã được cấp
              </p>
            </div>
          </div>

          {participantService.isZaloMode() ? (
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Số điện thoại chỉ được lấy từ quyền xác minh của Zalo, không nhập thủ công.
              </p>
              <Button
                htmlType="button"
                fullWidth
                onClick={handleGetZaloPhone}
                disabled={isFetchingPhone || !hasFollowedOA}
                className="!h-12 !rounded-2xl !bg-gradient-to-r !from-red-500 !via-red-600 !to-amber-600 !text-white !font-black !shadow-lg active:scale-95 transition-transform"
              >
                {isFetchingPhone
                  ? "ĐANG XÁC MINH ZALO..."
                  : "CHO PHÉP ZALO & THAM GIA QUAY"}
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 p-4 border border-amber-200 space-y-3">
              <p className="text-xs text-amber-700 font-semibold">
                Chế độ test local: nhập số điện thoại đã có trong danh sách khách hàng.
              </p>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={previewPhone}
                onChange={(event) => setPreviewPhone(event.target.value)}
                placeholder="Ví dụ: 0901234567"
                className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-amber-500"
                disabled={isPreviewLookup}
              />
              <Button
                htmlType="button"
                fullWidth
                onClick={handlePreviewLookup}
                disabled={isPreviewLookup || !hasFollowedOA}
                className="!h-12 !rounded-2xl !bg-gradient-to-r !from-amber-500 !to-orange-600 !text-white !font-black !shadow-lg active:scale-95 transition-transform"
              >
                {isPreviewLookup ? "ĐANG TRA CỨU..." : "TRA CỨU & THAM GIA TEST"}
              </Button>
            </div>
          )}

          {/* CUSTOMER FOUND PREVIEW CARD WITH REAL ZALO AVATAR */}
          {customer && (
            <div className="rounded-2xl bg-amber-50/90 p-4 border border-amber-200/90 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                {zaloAvatar ? (
                  <img
                    src={zaloAvatar}
                    alt={customer.name}
                    onError={() => setZaloAvatar(null)}
                    className="w-10 h-10 rounded-full border-2 border-amber-400 object-cover shadow shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white grid place-items-center font-black text-base shadow border border-amber-300/50 shrink-0">
                    {customer.name ? customer.name.trim().charAt(0).toUpperCase() : "👤"}
                  </div>
                )}
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700">
                    KHÁCH HÀNG ĐỦ ĐIỀU KIỆN
                  </div>
                  <div className="text-sm font-black text-slate-900 leading-none">
                    {customer.name}
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    {customer.phone}
                  </div>
                </div>
              </div>

              <div className="px-3 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white font-extrabold text-xs shadow-md text-center shrink-0">
                {customer.spinsRemaining} lượt còn lại
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-500 font-medium">
          {participantService.isZaloMode()
            ? "Zalo sẽ xác minh số điện thoại và tạo phiên tham gia tự động."
            : "Chế độ preview chỉ dùng để kiểm thử local, không dùng khi phát hành production."}
        </p>
      </div>
    </div>
  );
}
