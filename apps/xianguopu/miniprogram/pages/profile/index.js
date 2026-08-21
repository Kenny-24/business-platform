const api = require('../../services/api');
const cart = require('../../store/cart');
const session = require('../../utils/session');
const ui = require('../../utils/ui');
const { imageUrl } = require('../../utils/format');

function displayUser(user = {}) {
  return { ...user, avatarDisplay: user.avatarUrl ? imageUrl(user.avatarUrl) : '' };
}

function getWechatProfile() {
  if (!wx.getUserProfile) return Promise.resolve({});
  return new Promise(resolve => {
    wx.getUserProfile({
      desc: '用于展示会员头像和昵称',
      success: result => resolve({ nickname: result.userInfo.nickName, avatarUrl: result.userInfo.avatarUrl }),
      fail: () => resolve({})
    });
  });
}

Page({
  data: {
    top: 20,
    menuRight: 15,
    logged: false,
    user: {},
    loginLoading: false,
    ordersLoading: false,
    editorVisible: false,
    profileSaving: false,
    draftNickname: '',
    draftAvatar: '',
    draftAvatarLocal: '',
    draftAvatarDisplay: '',
    orderCount: 0
  },
  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const menuRight = menu && menu.left ? Number(info.windowWidth || 375) - menu.left + 8 : 15;
    this.setData({ top: info.statusBarHeight || 20, menuRight });
  },
  onShow() {
    const logged = session.isLoggedIn();
    this.syncUser(session.getUser(), logged);
    if (logged && (!this.lastOrderLoad || Date.now() - this.lastOrderLoad > 30000)) this.loadOrderCounts();
    if (logged && !this.profileSyncing) {
      this.profileSyncing = session.ensureValid().then(user => this.syncUser(user, true)).catch(() => {
        this.syncUser(session.getUser(), session.isLoggedIn());
      }).finally(() => { this.profileSyncing = null; });
    }
    cart.syncBadge();
  },
  syncUser(user = {}, logged = session.isLoggedIn()) {
    this.setData({ logged, user: displayUser(user) });
  },
  async loadOrderCounts() {
    if (this.data.ordersLoading) return;
    this.setData({ ordersLoading: true });
    try {
      const orders = await api.orders('');
      this.lastOrderLoad = Date.now();
      this.setData({ orderCount: orders.length, ordersLoading: false });
    } catch (error) {
      this.setData({ ordersLoading: false });
      if (!session.isLoggedIn()) this.setData({ orderCount: 0 });
      if (!session.isLoggedIn()) this.syncUser({}, false);
    }
  },
  handleMemberTap() {
    if (this.data.logged) return this.openProfileEditor();
    return this.login();
  },
  async login() {
    if (this.data.loginLoading) return null;
    if (this.data.logged) { this.openProfileEditor(); return this.data.user; }
    this.setData({ loginLoading: true });
    try {
      const profile = await getWechatProfile();
      const user = await session.login(profile);
      this.syncUser(user, true);
      this.setData({ loginLoading: false });
      this.lastOrderLoad = 0;
      this.loadOrderCounts();
      wx.showToast({ title: '微信登录成功', icon: 'none' });
      if (!user.nickname || !user.avatarUrl) setTimeout(() => this.openProfileEditor(), 260);
      return user;
    } catch (error) {
      this.setData({ loginLoading: false });
      wx.showToast({ title: error.message || '登录失败', icon: 'none' });
      return null;
    }
  },
  openProfileEditor() {
    const user = session.getUser();
    this.setData({
      editorVisible: true,
      draftNickname: user.nickname || user.nickName || '',
      draftAvatar: user.avatarUrl || '',
      draftAvatarLocal: '',
      draftAvatarDisplay: user.avatarUrl ? imageUrl(user.avatarUrl) : ''
    });
  },
  closeProfileEditor() {
    if (this.data.profileSaving) return;
    this.setData({ editorVisible: false, draftAvatarLocal: '' });
  },
  chooseAvatar(event) {
    const localPath = event.detail && event.detail.avatarUrl;
    if (!localPath) return;
    this.setData({ draftAvatarLocal: localPath, draftAvatarDisplay: localPath });
  },
  nicknameInput(event) { this.setData({ draftNickname: event.detail.value }); },
  async saveProfile() {
    if (this.data.profileSaving) return;
    const nickname = String(this.data.draftNickname || '').trim();
    if (!nickname) return wx.showToast({ title: '请输入昵称', icon: 'none' });
    if (nickname.length > 20) return wx.showToast({ title: '昵称最多 20 个字符', icon: 'none' });
    this.setData({ profileSaving: true });
    try {
      let avatarUrl = this.data.draftAvatar;
      if (this.data.draftAvatarLocal) {
        const uploaded = await api.uploadAvatar(this.data.draftAvatarLocal);
        avatarUrl = uploaded.url;
      }
      const payload = { nickname, ...(avatarUrl ? { avatarUrl } : {}) };
      const user = await api.updateProfile(payload);
      session.saveUser(user);
      this.syncUser(user, true);
      this.setData({ editorVisible: false, profileSaving: false, draftAvatarLocal: '' });
      wx.showToast({ title: '资料已保存', icon: 'success' });
    } catch (error) {
      this.setData({ profileSaving: false });
      wx.showToast({ title: error.message || '保存失败，请重试', icon: 'none' });
    }
  },
  async requireLogin(action) {
    try {
      if (this.data.logged) {
        const user = await session.ensureValid();
        this.syncUser(user, true);
        return action();
      }
      const user = await this.login();
      return user ? action() : null;
    } catch (error) {
      this.syncUser(session.getUser(), session.isLoggedIn());
      wx.showToast({ title: error.message || '登录状态校验失败', icon: 'none' });
      return null;
    }
  },
  noop() {},
  orders() { this.requireLogin(() => ui.navigate('/subpackages/order/list/index')); },
  addresses() { this.requireLogin(() => ui.navigate('/subpackages/address/list/index')); },
  about() { wx.showModal({ title: '关于鲜果铺', content: '我们按季节、产地和成熟度挑选水果，希望每一份到家都处在好吃的时刻。', showCancel: false, confirmText: '好的', confirmColor: '#2F5F47' }); },
  logout() {
    wx.showModal({
      title: '退出当前账号？',
      success: result => {
        if (!result.confirm) return;
        session.clearSession();
        this.lastOrderLoad = 0;
        this.setData({
          logged: false,
          user: {},
          editorVisible: false,
          orderCount: 0
        });
      }
    });
  }
});
