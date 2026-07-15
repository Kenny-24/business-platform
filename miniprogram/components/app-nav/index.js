const { getLayoutMetrics } = require('../../utils/layout')

Component({
  options: {
    styleIsolation: 'isolated'
  },

  properties: {
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    brand: { type: Boolean, value: false },
    transparent: { type: Boolean, value: false },
    overlay: { type: Boolean, value: false },
    light: { type: Boolean, value: false },
    solid: { type: Boolean, value: false },
    showLocation: { type: Boolean, value: false },
    locationText: { type: String, value: '选择位置' }
  },

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    totalHeight: 64
  },

  lifetimes: {
    attached() {
      const metrics = getLayoutMetrics()
      const navBarHeight = this.data.brand
        ? Math.max(50, metrics.navBarHeight)
        : metrics.navBarHeight

      this.setData({
        statusBarHeight: metrics.statusBarHeight,
        navBarHeight,
        totalHeight: metrics.statusBarHeight + navBarHeight
      })
    }
  },

  methods: {
    onLocationTap() {
      this.triggerEvent('location')
    }
  }
})
