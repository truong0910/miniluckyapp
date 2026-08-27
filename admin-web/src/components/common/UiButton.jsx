import React from "react";

export default function UiButton({
  children,
  variant = "primary", // "primary" | "secondary" | "danger" | "warning" | "success"
  size = "md", // "sm" | "md" | "lg"
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  className = "",
  style = {},
  ...props
}) {
  return (
    <button
      type={type}
      className={`btn-ui btn-ui-${variant} btn-ui-${size} ${loading ? "is-loading" : ""} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      style={style}
      {...props}
    >
      {loading ? (
        <span className="btn-spinner-wrapper">
          <span className="btn-spinner"></span>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
