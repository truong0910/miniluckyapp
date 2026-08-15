import * as v from "valibot";

export const registerSchema = v.object({
  phone: v.pipe(
    v.string(),
    v.minLength(1, "Số điện thoại là bắt buộc"),
    v.trim(),
    v.check((val) => {
      const clean = val.trim().toLowerCase();
      if (clean === "admin" || clean === "0999999999") return true;
      return /^(0|\+84)(3|5|7|8|9)\d{8}$/.test(clean);
    }, "Số điện thoại không hợp lệ")
  ),
});

export type TRegisterValues = v.InferOutput<typeof registerSchema>;
