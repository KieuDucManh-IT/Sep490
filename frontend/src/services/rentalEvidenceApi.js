import { rentalRequest } from './rentalOrderApi';
import { salesRequest } from './salesOrderApi';

const getOrderPath = (orderType) => {
  if (orderType === 'rental') {
    return 'rental-orders';
  }

  if (orderType === 'sale') {
    return 'sales-orders';
  }

  throw new Error('Loại đơn hàng không hợp lệ.');
};

export const getRentalEvidence = (
  orderId,
  orderType = 'rental'
) => {
  getOrderPath(orderType);

  const request =
    orderType === 'sale'
      ? salesRequest
      : rentalRequest;

  return request(
    `/${encodeURIComponent(orderId)}/evidence`
  );
};

export function uploadRentalEvidence(
  orderId,
  kind,
  file,
  {
    onProgress,
    signal,
    orderType = 'rental',
  } = {}
) {
  return new Promise((resolve, reject) => {
    const orderPath = getOrderPath(orderType);

    const xhr = new XMLHttpRequest();

    const base = (
      process.env.REACT_APP_API_URL ||
      'http://localhost:5001/api'
    ).replace(/\/+$/, '');

    xhr.open(
      'POST',
      `${base}/${orderPath}/${encodeURIComponent(orderId)}/evidence/${kind}`
    );

    xhr.withCredentials = true;
    xhr.timeout = 10 * 60 * 1000;

    const token = localStorage.getItem('token');

    if (token) {
      xhr.setRequestHeader(
        'Authorization',
        `Bearer ${token}`
      );
    }

    const abort = () => xhr.abort();

    const cleanup = () => {
      signal?.removeEventListener('abort', abort);
    };

    const fail = (message) => {
      cleanup();
      reject(new Error(message));
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round(
          (event.loaded * 100) / event.total
        );

        onProgress?.(percentage);
      }
    };

    xhr.onload = () => {
      cleanup();

      let result;

      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        result = null;
      }

      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        result?.data
      ) {
        resolve(result.data);
        return;
      }

      reject(
        new Error(
          result?.message ||
          'Không thể tải video. Vui lòng thử lại.'
        )
      );
    };

    xhr.onerror = () =>
      fail(
        'Mất kết nối khi tải video. Vui lòng kiểm tra mạng và tải lại danh sách trước khi thử lại.'
      );

    xhr.ontimeout = () =>
      fail(
        'Tải video quá lâu. Hãy tải lại danh sách để kiểm tra trước khi gửi lại.'
      );

    xhr.onabort = () => {
      cleanup();

      reject(
        Object.assign(
          new Error('Đã dừng tải video.'),
          { name: 'AbortError' }
        )
      );
    };

    if (signal?.aborted) {
      xhr.onabort();
      return;
    }

    signal?.addEventListener('abort', abort, {
      once: true,
    });

    const form = new FormData();

    form.append('video', file);

    xhr.send(form);
  });
}