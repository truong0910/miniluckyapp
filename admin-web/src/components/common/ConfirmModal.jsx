import React from "react";
import UiButton from "./UiButton.jsx";

export default function ConfirmModal({
  isOpen,
  title = "Xác nhận hành động",
  message,
  children,
  confirmText = "Xác nhận",
  cancelText = "Hủy bỏ",
  variant = "primary", // "primary" | "danger" | "warning" | "success"
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="modal-close-btn" onClick={onCancel}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {message && <p className="modal-message">{message}</p>}
          {children}
        </div>

        <div className="modal-footer">
          <UiButton variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelText}
          </UiButton>
          <UiButton variant={variant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </UiButton>
        </div>
      </div>
    </div>
  );
}
