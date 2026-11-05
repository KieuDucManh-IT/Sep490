import React from 'react';
import { Spinner } from 'react-bootstrap';
import { RotateCcw, Save, Check } from 'lucide-react';

export default function ShopSettingsActionBar({ isDirty, saving, onReset }) {
  return (
    <div className="settings-action-bar">
      {/* Left Side: Change State Indicator */}
      <div className="d-flex align-items-center gap-2">
        {isDirty ? (
          <span className="settings-dirty-badge">
            <span className="settings-dirty-dot" />
            Có thay đổi chưa lưu
          </span>
        ) : (
          <span className="settings-clean-badge">
            <Check size={13} className="text-emerald-500" />
            Dữ liệu đã đồng bộ
          </span>
        )}
      </div>

      {/* Right Side: Action Buttons */}
      <div className="d-flex align-items-center gap-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 settings-btn-reset"
          onClick={onReset}
          disabled={!isDirty || saving}
        >
          <RotateCcw size={14} />
          <span>Hoàn Tác</span>
        </button>

        <button
          type="submit"
          className="btn btn-sm btn-dark d-inline-flex align-items-center gap-1 settings-btn-save"
          disabled={saving || !isDirty}
        >
          {saving ? (
            <>
              <Spinner size="sm" animation="border" className="me-1" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>Lưu Thay Đổi</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
