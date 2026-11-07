export const getApiUrl = () => process.env.GHN_API_URL || 'https://dev-online-gateway.ghn.vn';
export const getToken = () => process.env.GHN_API_TOKEN || '';
export const getShopId = () => process.env.GHN_SHOP_ID || '';

export const isMockMode = () => {
  if (process.env.GHN_MOCK_MODE !== undefined) {
    return process.env.GHN_MOCK_MODE === 'true';
  }
  return !getToken();
};

export const ghnConfig = {
  get apiUrl() { return getApiUrl(); },
  get token() { return getToken(); },
  get shopId() { return parseInt(getShopId(), 10) || 0; },
  get isMock() { return isMockMode(); },
};

/**
 * Native fetch-based GHN HTTP Client (Zero external dependency)
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
