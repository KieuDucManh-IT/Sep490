import React from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { AlertCircle, CheckCircle2, RotateCcw, Save } from 'lucide-react';

export default function BranchSettingsActionBar({ isDirty, saving, onReset }) {
  return (
    <div className="branch-action-bar">
      <div className="d-flex align-items-center gap-2">
        {isDirty ? (
          <span className="branch-action-status dirty">
            <AlertCircle size={15} />
            <span>Bạn có thay đổi chưa lưu trên form</span>
          </span>
        ) : (
          <span className="branch-action-status clean">
            <CheckCircle2 size={15} />
            <span>Dữ liệu cửa hàng đã được đồng bộ mới nhất</span>
          </span>
        )}
      </div>

      <div className="d-flex align-items-center gap-2">
        <button
          type="button"
          className="btn btn-outline-secondary d-inline-flex align-items-center gap-1 branch-btn-reset"
          onClick={onReset}
          disabled={!isDirty || saving}
        >
          <RotateCcw size={13} />
          <span>Hoàn Tác</span>
        </button>
        <Button
          type="submit"
          variant="dark"
          className="d-inline-flex align-items-center gap-2 branch-btn-save"
          disabled={saving || !isDirty}
        >
          {saving ? (
            <>
              <Spinner size="sm" animation="border" />
              <span>Đang Lưu Cập Nhật...</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>Lưu Cập Nhật Cửa Hàng</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
