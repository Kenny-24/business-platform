let routeLocked = false;

function feedback(type = 'light') {
  if (!wx.vibrateShort) return;
  wx.vibrateShort({ type, fail: () => {} });
}

function navigate(url, mode = 'navigateTo') {
  if (!url || routeLocked) return false;
  routeLocked = true;
  const release = () => setTimeout(() => { routeLocked = false; }, 360);
  const options = { url, success: release, fail: release };
  if (mode === 'switchTab') wx.switchTab(options);
  else if (mode === 'redirectTo') wx.redirectTo(options);
  else wx.navigateTo(options);
  return true;
}

function addedToast() {
  feedback('light');
  wx.showToast({ title: '已加入果篮', icon: 'none', duration: 900 });
}

module.exports = { feedback, navigate, addedToast };
