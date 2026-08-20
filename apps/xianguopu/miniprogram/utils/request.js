const { API_BASE_URL } = require('../config/env');

function request(path, options = {}) {
  const token = getApp()?.globalData?.token || wx.getStorageSync('token') || '';
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data || undefined,
      timeout: 10000,
      header: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.header || {}) },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else {
          if (res.statusCode === 401) { wx.removeStorageSync('token'); if (getApp()) getApp().globalData.token=''; }
          const message = res.data?.message || `请求失败(${res.statusCode})`;
          reject(new Error(message));
        }
      },
      fail(err) { reject(new Error(err.errMsg || '网络连接失败')); }
    });
  });
}
module.exports = { request };
