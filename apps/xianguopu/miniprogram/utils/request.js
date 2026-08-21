const { API_BASE_URL } = require('../config/env');

function clearExpiredSession() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('user_profile');
  const app = getApp();
  if (app) { app.globalData.token = ''; app.globalData.user = null; }
}

function networkMessage(error) {
  const detail = String(error && error.errMsg || '');
  if (/timeout/i.test(detail)) return '请求超时，请检查网络后重试';
  return '无法连接服务，请确认 API 已启动';
}

function authHeader() {
  const token = (getApp() && getApp().globalData.token) || wx.getStorageSync('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function request(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const maxRetries = options.retries == null ? (method === 'GET' ? 1 : 0) : Math.max(Number(options.retries), 0);

  return new Promise((resolve, reject) => {
    const run = attempt => {
      wx.request({
        url: `${API_BASE_URL}${path}`,
        method,
        data: options.data || undefined,
        timeout: Number(options.timeout || 12000),
        header: {
          'content-type': 'application/json',
          ...authHeader(),
          ...(options.header || {})
        },
        success(response) {
          if (response.statusCode >= 200 && response.statusCode < 300) return resolve(response.data);
          if (response.statusCode >= 500 && attempt < maxRetries) return setTimeout(() => run(attempt + 1), 260 * (attempt + 1));
          if (response.statusCode === 401) clearExpiredSession();
          reject(new Error(response.data && response.data.message || `请求失败（${response.statusCode}）`));
        },
        fail(error) {
          if (attempt < maxRetries) return setTimeout(() => run(attempt + 1), 260 * (attempt + 1));
          reject(new Error(networkMessage(error)));
        }
      });
    };
    run(0);
  });
}

function upload(path, filePath, options = {}) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}${path}`,
      filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header: { ...authHeader(), ...(options.header || {}) },
      timeout: Number(options.timeout || 20000),
      success(response) {
        let data = response.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (error) { data = { message: data || '上传失败' }; }
        }
        if (response.statusCode >= 200 && response.statusCode < 300) return resolve(data);
        if (response.statusCode === 401) clearExpiredSession();
        reject(new Error(data && data.message || `上传失败（${response.statusCode}）`));
      },
      fail(error) { reject(new Error(networkMessage(error))); }
    });
  });
}

module.exports = { request, upload };
