import React from 'react';

/**
 * Kế hoạch lấy hàng gợi ý cho một dòng phiếu, dạng "Kệ A-01-03: 4 món (ITM-…)".
 * @param {{ line: { picks: object[], shortage: number, needed: number, centralAvailable: number } }} props
 */
export default function PickSuggestionList({ line }) {
  if (!line || !(line.needed > 0)) return null;
  return <div>
    <small className="wm-stock-subline mt-0">Gợi ý lấy hàng:</small>
    {line.picks.length > 0 && <ol className="wm-pick-suggestion-list">
      {line.picks.map((pick) => <li key={String(pick.storageId)}>
        Kệ {pick.storageCode || '—'}: {pick.quantity} món
        {pick.itemCodes?.length > 0 && ` (${pick.itemCodes.join(', ')})`}
      </li>)}
    </ol>}
    {line.shortage > 0 && <div className="wm-transfer-short-label">
      Thiếu {line.shortage} món — kho tổng chỉ còn {line.centralAvailable ?? 0} khả dụng trên kệ.
    </div>}
  </div>;
}
