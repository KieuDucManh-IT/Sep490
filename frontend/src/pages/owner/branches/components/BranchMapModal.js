import React from 'react';
import { Modal } from 'react-bootstrap';
import { Compass, MapPin, ExternalLink, Navigation } from 'lucide-react';
import LeafletMapPicker from '../../../../components/LeafletMapPicker';

export default function BranchMapModal({ show, onHide, branch }) {
  if (!branch) return null;

  const lat = parseFloat(branch.latitude) || 21.028511;
  const lng = parseFloat(branch.longitude) || 105.854167;
  const fullAddress = [branch.address, branch.ward, branch.city].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ';
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      dialogClassName="vestora-modal-dialog"
    >
      <div className="vestora-modal-header">
        <div className="modal-header-brand-wrap">
          <div className="modal-header-icon-badge">
            <Compass size={20} />
          </div>
          <div>
            <h5 className="modal-title-main">Vị Trí Bản Đồ — {branch.name}</h5>
            <div className="d-flex align-items-center gap-2 modal-subtitle-text">
              <MapPin size={13} className="text-danger flex-shrink-0" />
              <span>{fullAddress}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={onHide}
          aria-label="Đóng"
        />
      </div>

      <div className="vestora-modal-body p-0">
        <div className="px-3 py-2 bg-light border-bottom d-flex align-items-center justify-content-between">
          <span className="small text-muted">
            Tọa độ vị trí: <strong>{lat.toFixed(6)}, {lng.toFixed(6)}</strong>
          </span>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
          >
            <Navigation size={13} />
            <span>Chỉ đường trên Google Maps</span>
            <ExternalLink size={11} />
          </a>
        </div>

        <div className="form-map-picker-box rounded-0 border-0">
          <LeafletMapPicker
            latitude={lat}
            longitude={lng}
            height="450px"
          />
        </div>
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="btn-modal-secondary"
          onClick={onHide}
        >
          Đóng
        </button>
      </div>
    </Modal>
  );
}
