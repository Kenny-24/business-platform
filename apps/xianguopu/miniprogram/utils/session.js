const api = require('../services/api');

let loginPromise = null;

function getUser() {
  return wx.getStorageSync('user_profile') || (getApp() && getApp().globalData.user) || {};
}

function isLoggedIn() {
  return Boolean(wx.getStorageSync('token'));
}

function normalizeProfile(profile = {}) {
  const nickname = String(profile.nickname || profile.nickName || '').trim();
  const avatarUrl = String(profile.avatarUrl || '').trim();
  return {
    ...(nickname ? { nickname } : {}),
    ...(avatarUrl ? { avatarUrl } : {})
  };
}

function saveUser(user = {}) {
  const merged = { ...getUser(), ...user };
  wx.setStorageSync('user_profile', merged);
  const app = getApp();
  if (app) app.globalData.user = merged;
  return merged;
}

function saveSession(data, profile = {}) {
  const user = { ...(data.user || {}), ...normalizeProfile(profile), ...(profile || {}) };
  wx.setStorageSync('token', data.token);
  wx.setStorageSync('user_profile', user);
  const app = getApp();
  if (app) {
    app.globalData.token = data.token;
    app.globalData.user = user;
  }
  return user;
}

function clearSession() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('user_profile');
  const app = getApp();
  if (app) {
    app.globalData.token = '';
    app.globalData.user = null;
  }
}

function login(profile = {}) {
  if (isLoggedIn()) return Promise.resolve(getUser());
  if (loginPromise) return loginPromise;
  loginPromise = new Promise((resolve, reject) => {
    wx.login({
      success: async result => {
        try {
          const data = await api.wxLogin(result.code, normalizeProfile(profile));
          resolve(saveSession(data, profile));
        } catch (error) { reject(error); }
      },
      fail: () => reject(new Error('微信登录未完成'))
    });
  }).finally(() => { loginPromise = null; });
  return loginPromise;
}

async function ensureValid(profile = {}) {
  if (!isLoggedIn()) return login(profile);
  try {
    const remoteUser = await api.me();
    const token = wx.getStorageSync('token');
    return saveSession({ token, user: { ...getUser(), ...remoteUser } }, profile);
  } catch (error) {
    if (!isLoggedIn()) return login(profile);
    throw error;
  }
}

module.exports = { getUser, isLoggedIn, saveUser, saveSession, clearSession, login, ensureValid };
