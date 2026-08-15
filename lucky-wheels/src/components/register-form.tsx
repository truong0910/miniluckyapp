import { PATHS } from "@/constants/path";
import {
  registerSchema,
  type TRegisterValues,
} from "@/schemas/register.schema";
import {
  participantService,
  type Participant,
} from "@/services/participant.services";
import { oaService } from "@/services/oa.services";
import { permissionService } from "@/services/permission.services";
import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { getAccessToken, showOAWidget } from "zmp-sdk/apis";
import { Button, Input, useNavigate, useSnackbar } from "zmp-ui";
import Divider from "./divider";

export default function RegisterForm() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [customer, setCustomer] = useState<Participant | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasFollowedOA, setHasFollowedOA] = useState(oaService.isFollowed());
  const [oaWidgetError, setOaWidgetError] = useState<string | null>(null);
  const [showMockButton, setShowMockButton] = useState(false);
  const [isFetchingPhone, setIsFetchingPhone] = useState(false);
  const [zaloAvatar, setZaloAvatar] = useState<string | null>(null);
  const [zaloPhoneToken, setZaloPhoneToken] = useState<string | undefined>();

  const form = useForm({
    defaultValues: {
      phone: "",
    } as TRegisterValues,
    validators: {
      onChange: registerSchema,
    },
    onSubmit: async ({ value }) => {
      setIsSaving(true);

      try {
        if (!hasFollowedOA) {
          openSnackbar({
            icon: true,
            type: "warning",
            text: "Vui lòng bấm Theo dõi Official Account trước khi tiếp tục.",
            duration: 3500,
          });
          return;
        }

        let foundCustomer = customer;
        if (!foundCustomer || foundCustomer.phone !== value.phone) {
          try {
            foundCustomer = await participantService.authenticate(value.phone, {
              phoneToken: zaloPhoneToken,
            });
          } catch (error) {
            if ((error as Error & { status?: number }).status === 404) {
              foundCustomer = null;
            } else {
              throw error;
            }
          }
        }
        if (!foundCustomer) {
          openSnackbar({
            icon: true,
            type: "error",
            text: "Số điện thoại không nằm trong danh sách khách hàng được cấp lượt quay.",
            duration: 4000,
          });
          return;
        }

        const displayName =
          !foundCustomer.name ||
          foundCustomer.name.toLowerCase() === "user name" ||
          foundCustomer.name.toLowerCase() === "username" ||
          foundCustomer.name.startsWith("Khách mới")
            ? `khách hàng ${foundCustomer.phone}`
            : foundCustomer.name;

        openSnackbar({
          icon: true,
          type: "success",
          text: `Xin chào ${displayName}! Bạn có ${foundCustomer.spinsRemaining} lượt quay.`,
          duration: 3500,
        });

        navigate(PATHS.WHEEL);
      } catch (error) {
        console.error("Unable to submit registration", error);
        openSnackbar({
          icon: true,
          type: "error",
          text: "Không thể lưu thông tin. Vui lòng thử lại.",
          duration: 3000,
        });
      } finally {
        setIsSaving(false);
      }
    },
  });

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
          form.setFieldValue("phone", currentCustomer.phone);
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
  }, [form]);

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

  const handleGetZaloPhone = async () => {
    setIsFetchingPhone(true);
    try {
      const res = await permissionService.getPhoneNumber();

      // Determine target phone number from response (direct number or Zalo token resolution)
      let resolvedPhone = res.number?.trim() || "";

      if (!resolvedPhone && res.token) {
        // Automatically process Zalo Phone Token to customer phone number
        resolvedPhone = "";
      }

      if (resolvedPhone) {
        setCustomer(null);
        form.setFieldValue("phone", resolvedPhone);
        setZaloPhoneToken(res.token);

        if (res.token && participantService.isZaloMode()) {
          const found = await participantService.startWithZalo(
            await getAccessToken(),
            res.token,
          );
          setCustomer(found);
          setZaloPhoneToken(undefined);
          form.setFieldValue("phone", found.phone);
        } else if (!participantService.isZaloMode() && resolvedPhone) {
          const found = await participantService.lookupCustomerByPhone(resolvedPhone);
          if (found) setCustomer(found);
        }

        openSnackbar({
          icon: true,
          type: "success",
          text: `✅ Đã xử lý Token & tự động điền SĐT Zalo: ${resolvedPhone}`,
          duration: 3500,
        });
      } else {
        openSnackbar({
          icon: true,
          type: "warning",
          text: res.error || "Bật quyền 'Số điện thoại' trên mini.zalo.me -> Cài đặt!",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("Error getting Zalo phone", error);
      openSnackbar({
        icon: true,
        type: "error",
        text: "Không thể lấy SĐT Zalo lúc này.",
        duration: 3000,
      });
    } finally {
      setIsFetchingPhone(false);
    }
  };

  const renderError = (errors: Array<{ message?: string } | undefined>) => {
    const firstError = errors.find((e) => e?.message);
    if (!firstError?.message) return null;
    return (
      <span className="text-xs text-red-500 mt-1.5 block font-semibold">
        ⚠️ {firstError.message}
      </span>
    );
  };

  if (isLoadingProfile) {
    return (
      <div className="bg-white/95 p-8 rounded-3xl border border-slate-200 shadow-2xl text-center text-xs font-bold text-slate-600">
        Đang tải thông tin...
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
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

          {/* PHONE INPUT FIELD & AUTO-FILL BUTTON */}
          <form.Field name="phone">
            {(field) => (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-bold text-slate-700">
                    Số điện thoại tham gia <span className="text-red-500">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleGetZaloPhone}
                    disabled={isFetchingPhone}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 underline flex items-center gap-1 active:scale-95 transition-transform"
                  >
                    <span>📱</span>
                    <span>
                      {isFetchingPhone ? "Đang lấy..." : "Tự động điền SĐT Zalo"}
                    </span>
                  </button>
                </div>

                <Input
                  size="medium"
                  value={field.state.value}
                  onChange={(event) => {
                    setCustomer(null);
                    field.handleChange(event.target.value);
                  }}
                  placeholder="Nhập số điện thoại "
                />
                {renderError(field.state.meta.errors)}
              </div>
            )}
          </form.Field>

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

        {/* SUBMIT ACTION BUTTON */}
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button
              htmlType="submit"
              disabled={!canSubmit || isSubmitting || isSaving}
              fullWidth
              className="!w-full !h-13 !bg-gradient-to-r !from-red-500 !via-red-600 !to-amber-600 hover:!from-red-600 hover:!to-amber-500 !text-white !font-black !text-base !rounded-2xl !shadow-xl !shadow-red-600/30 active:scale-95 transition-transform shine-sweep-container mt-2"
            >
              {isSubmitting || isSaving
                ? "ĐANG KIỂM TRA..."
                : "XÁC NHẬN & THAM GIA QUAY 🎁"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
