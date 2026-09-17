import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type WebButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  htmlType?: "button" | "submit" | "reset";
  fullWidth?: boolean;
  size?: "small" | "medium" | "large";
};

export function Button({ htmlType = "button", fullWidth, size: _size, className = "", ...props }: WebButtonProps) {
  return (
    <button
      type={htmlType}
      className={`${fullWidth ? "w-full " : ""}${className}`.trim()}
      {...props}
    />
  );
}

export function Page({ hideScrollbar: _hideScrollbar, className = "", children, ...props }: HTMLAttributes<HTMLDivElement> & { hideScrollbar?: boolean; children?: ReactNode }) {
  return <main className={className} {...props}>{children}</main>;
}

export { useNavigate };
