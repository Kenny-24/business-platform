const { request, upload } = require('../utils/request');

const resourceCache = {};
function cached(key, maxAge, loader, force) {
  const now = Date.now();
  const hit = resourceCache[key];
  if (!force && hit && hit.value && now - hit.time < maxAge) return Promise.resolve(hit.value);
  if (!force && hit && hit.promise) return hit.promise;
  const promise = loader().then(value => {
    resourceCache[key] = { value, time: Date.now(), promise: null };
    return value;
  }).catch(error => {
    if (resourceCache[key]) resourceCache[key].promise = null;
    throw error;
  });
  resourceCache[key] = { ...(hit || {}), promise };
  return promise;
}

module.exports = {
  storeSettings: force => cached('store', 5 * 60 * 1000, () => request('/settings/store'), force),
  categories: force => cached('categories', 5 * 60 * 1000, () => request('/categories'), force),
  products: (params = {}) => request(`/products?${Object.keys(params).filter(key => params[key] !== '' && params[key] != null).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&')}`),
  product: id => request(`/products/${id}`),
  wxLogin: (code, profile = {}) => request('/auth/wx/login', { method: 'POST', data: { code, nickname: profile.nickname || profile.nickName || '', avatarUrl: profile.avatarUrl || '' } }),
  me: () => request('/user/me'),
  updateProfile: data => request('/user/me', { method: 'PUT', data }),
  uploadAvatar: filePath => upload('/user/me/avatar', filePath),
  addresses: () => request('/user/addresses'),
  createAddress: data => request('/user/addresses', { method: 'POST', data }),
  updateAddress: (id, data) => request(`/user/addresses/${id}`, { method: 'PUT', data }),
  deleteAddress: id => request(`/user/addresses/${id}`, { method: 'DELETE' }),
  createOrder: data => request('/user/orders', { method: 'POST', data }),
  orders: status => request(`/user/orders${status ? `?status=${status}` : ''}`),
  order: id => request(`/user/orders/${id}`)
};
