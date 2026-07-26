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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getLayoutMetrics() {
  const windowInfo = getWindowInfoSafe()
  const menuRect = getMenuRectSafe()

  const windowWidth = Number(windowInfo.windowWidth || windowInfo.screenWidth || 375)
  const windowHeight = Number(windowInfo.windowHeight || windowInfo.screenHeight || 667)
  const statusBarHeight = Number(windowInfo.statusBarHeight || 20)
  const pixelRatio = Number(windowInfo.pixelRatio || 2)

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

  const isNarrowScreen = windowWidth <= 320
  const isSmallScreen = windowWidth <= 360
  const isMediumScreen = windowWidth > 360 && windowWidth < 720
  const isWideScreen = windowWidth >= 720
  const isTablet = windowWidth >= 600

  const horizontalPadding = isNarrowScreen
    ? 12
    : isSmallScreen
      ? 14
      : isWideScreen
        ? clamp(Math.round(windowWidth * 0.045), 28, 44)
        : clamp(Math.round(windowWidth * 0.048), 16, 22)

  const contentMaxWidth = isWideScreen ? 960 : windowWidth
  const uiScale = clamp(windowWidth / 375, 0.88, 1.16)
  const densityClass = isNarrowScreen
    ? 'narrow'
    : isSmallScreen
      ? 'compact'
      : isWideScreen
        ? 'wide'
        : 'regular'

  return {
    windowWidth,
    windowHeight,
    statusBarHeight,
    navBarHeight,
    navTotalHeight,
    contentHeight,
    capsuleSafeWidth,
    pixelRatio,
    horizontalPadding,
    contentMaxWidth,
    uiScale,
    densityClass,
    isIOS: platform.includes('ios'),
    isNarrowScreen,
    isSmallScreen,
    isMediumScreen,
    isWideScreen,
    isTablet
  }
}

module.exports = { getLayoutMetrics }
