App({
  globalData: { token: '', user: null },
  onLaunch() {
    const token = wx.getStorageSync('token') || '';
    this.globalData.token = token;
  }
});
