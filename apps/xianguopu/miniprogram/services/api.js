const { request } = require('../utils/request');
module.exports = {
  storeSettings: () => request('/settings/store'),
  categories: () => request('/categories'),
  products: (params={}) => request(`/products?${Object.keys(params).filter(k=>params[k]!==''&&params[k]!=null).map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&')}`),
  product: id => request(`/products/${id}`),
  wxLogin: code => request('/auth/wx/login', { method:'POST', data:{code} }),
  addresses: () => request('/user/addresses'),
  createAddress: data => request('/user/addresses', {method:'POST',data}),
  updateAddress: (id,data) => request(`/user/addresses/${id}`, {method:'PUT',data}),
  deleteAddress: id => request(`/user/addresses/${id}`, {method:'DELETE'}),
  createOrder: data => request('/user/orders', {method:'POST',data}),
  orders: status => request(`/user/orders${status?`?status=${status}`:''}`),
  order: id => request(`/user/orders/${id}`)
};
