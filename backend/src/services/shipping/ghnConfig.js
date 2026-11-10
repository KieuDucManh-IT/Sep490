export const getApiUrl = () => {
  const url = process.env.GHN_API_URL || 'https://dev-online-gateway.ghn.vn';
  // Safety Guard: Ngăn chặn tuyệt đối việc vô tình gọi vào cổng Production có tính phí khi đang ở dev/test
  if (process.env.NODE_ENV !== 'production' && !url.includes('dev-online-gateway.ghn.vn')) {
    throw new Error('[SECURITY ALERT] Chỉ được phép kết nối cổng GHN Dev Sandbox (dev-online-gateway.ghn.vn) trong môi trường phát triển!');
  }
  return url;
};
export const getToken = () => {
  const token = process.env.GHN_API_TOKEN;
  if (!token) {
    throw new Error('Chưa cấu hình GHN_API_TOKEN trong hệ thống môi trường.');
  }
  return token;
};
export const getShopId = () => process.env.GHN_SHOP_ID || '';
export const getWebhookSecret = () => process.env.GHN_WEBHOOK_SECRET || 'vestora_ghn_webhook_secret_2026';

export const ghnConfig = {
  get apiUrl() { return getApiUrl(); },
  get token() { return getToken(); },
  get shopId() { return parseInt(getShopId(), 10) || 0; },
  get webhookSecret() { return getWebhookSecret(); },
};

/**
 * Native fetch-based GHN HTTP Client (Zero external dependency)
 * Kết nối trực tiếp 100% với hệ thống GHN API
 */
export const ghnRequest = async (endpoint, { method = 'GET', data, params, headers: customHeaders, shopId } = {}) => {
  const apiUrl = getApiUrl();
  const token = getToken();
  const defaultShopId = getShopId();

  let url = `${apiUrl}${endpoint}`;
  if (params && Object.keys(params).length) {
    const searchParams = new URLSearchParams(params);
    url += (url.includes('?') ? '&' : '?') + searchParams.toString();
  }

  const effectiveShopId = shopId || customHeaders?.ShopId || defaultShopId || '';

  const options = {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      'Content-Type': 'application/json',
      Token: token,
      ...(effectiveShopId ? { ShopId: String(effectiveShopId) } : {}),
      ...customHeaders,
    },
  };

  if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(url, options);
  const responseData = await res.json().catch(() => ({}));
  if (!res.ok || (responseData && responseData.code && responseData.code !== 200)) {
    const error = new Error(responseData?.message || `GHN API error: ${res.status}`);
    error.status = res.status;
    error.data = responseData;
    throw error;
  }
  return responseData;
};
