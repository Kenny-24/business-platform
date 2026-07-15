function getWindowInfoSafe() {
  try {
    if (typeof wx.getWindowInfo === 'function') return wx.getWindowInfo()
  } catch (error) {}

  try {
    return wx.getSystemInfoSync()
  } catch (error) {
    return {}
  }
}

function getMenuRectSafe() {
  try {
    return wx.getMenuButtonBoundingClientRect()
  } catch (error) {
    return null
  }
}

function getLayoutMetrics() {
  const windowInfo = getWindowInfoSafe()
  const menuRect = getMenuRectSafe()

  const windowWidth = windowInfo.windowWidth || windowInfo.screenWidth || 375
  const windowHeight = windowInfo.windowHeight || windowInfo.screenHeight || 667
  const statusBarHeight = windowInfo.statusBarHeight || 20

  let navBarHeight = 44
  let capsuleSafeWidth = 96

  if (menuRect && menuRect.height && menuRect.top) {
    const verticalGap = Math.max(0, menuRect.top - statusBarHeight)
    navBarHeight = menuRect.height + verticalGap * 2
    capsuleSafeWidth = Math.max(88, windowWidth - menuRect.left + 8)
  }

  const navTotalHeight = statusBarHeight + navBarHeight
  const contentHeight = Math.max(320, windowHeight - navTotalHeight)
  const platform = String(windowInfo.platform || windowInfo.system || '').toLowerCase()

  return {
    windowWidth,
    windowHeight,
    statusBarHeight,
    navBarHeight,
    navTotalHeight,
    contentHeight,
    capsuleSafeWidth,
    isIOS: platform.includes('ios'),
    isSmallScreen: windowWidth <= 360
  }
}

module.exports = { getLayoutMetrics }
