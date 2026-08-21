App({
  globalData: { token: '', user: null },
  onLaunch() {
    const token = wx.getStorageSync('token') || '';
    this.globalData.token = token;
    this.globalData.user = wx.getStorageSync('user_profile') || null;
  }
});
