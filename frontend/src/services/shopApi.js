let rawApiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
if (rawApiUrl.includes(':5001')) {
  rawApiUrl = rawApiUrl.replace(':5001', ':5000');
}
const API_ROOT = rawApiUrl
  .replace(/\/api\/?$/, '')
  .replace(/\/+$/, '');

async function fetchJson(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const url = `${API_ROOT}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  let response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch (netErr) {
    throw new Error(
      netErr.message === 'Failed to fetch'
        ? 'Không thể kết nối đến máy chủ backend (ERR_CONNECTION_REFUSED).'
        : (netErr.message || 'Lỗi kết nối mạng.')
    );
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Lỗi yêu cầu (mã ${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const getMyShopApi = async (ownerId) => {
  const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
  return fetchJson(`/api/shops/my-shop${query}`);
};

export const getAssignedBranchApi = async () => {
  return fetchJson('/api/shops/assigned-branch');
};

export const updateShopAddressApi = async (shopId, addressData) => {
  return fetchJson(`/api/shops/${shopId}/address`, {
    method: 'PUT',
    body: JSON.stringify(addressData),
  });
};

export const reverseGeocodeApi = async (latitude, longitude) => {
  return fetchJson(`/api/shops/reverse-geocode?lat=${latitude}&lng=${longitude}`);
};

export const getShopsListApi = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      qs.set(key, String(val));
    }
  });
  const queryString = qs.toString() ? `?${qs.toString()}` : '';
  return fetchJson(`/api/shops${queryString}`);
};

export const getShopByIdApi = async (shopId) => {
  return fetchJson(`/api/shops/${shopId}`);
};

export const getAdminShopsStatsApi = async () => {
  return fetchJson('/api/admin/shops/stats');
};

export const getAdminShopsListApi = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      qs.set(key, String(val));
    }
  });
  const queryString = qs.toString() ? `?${qs.toString()}` : '';
  return fetchJson(`/api/admin/shops${queryString}`);
};

export const toggleSuspendShopApi = async (shopId, payload) => {
  return fetchJson(`/api/admin/shops/${shopId}/toggle-suspend`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const updateShopInfoApi = async (shopId, shopData) => {
  return fetchJson(`/api/shops/${shopId}/info`, {
    method: 'PUT',
    body: JSON.stringify(shopData),
  });
};

export const createBranchApi = async (branchData) => {
  return fetchJson('/api/shops', {
    method: 'POST',
    body: JSON.stringify(branchData),
  });
};

export const deleteBranchApi = async (branchId) => {
  return fetchJson(`/api/shops/${branchId}`, {
    method: 'DELETE',
  });
};

export const getBranchManagersApi = async () => {
  return fetchJson('/api/shops/managers');
};

export const updateBranchInfoApi = updateShopInfoApi;
export const getBranchesListApi = getShopsListApi;

export const uploadShopImageApi = async (file, type = 'avatar') => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const url = `${API_ROOT}/api/shops/upload-image`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Lỗi tải ảnh lên (mã ${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};


