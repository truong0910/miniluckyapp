import React from "react";

export default function UiAlert({
  type = "error", // "error" | "success" | "warning" | "info"
  title,
  message,
  children,
  onClose,
  className = "",
  style = {},
}) {
  const content = message || children;
  if (!content && !title) return null;

  return (
    <div className={`ui-alert ui-alert-${type} ${className}`} style={style} role="alert">
      <div className="ui-alert-body">
        {title && <h4 className="ui-alert-title">{title}</h4>}
        <div className="ui-alert-content">{content}</div>
      </div>
      {onClose && (
        <button type="button" className="ui-alert-close" onClick={onClose} aria-label="Đóng">
          &times;
        </button>
      )}
    </div>
  );
}
