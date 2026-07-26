Component({
  properties: {
    compact: {
      type: Boolean,
      value: false
    },
    title: String,
    subtitle: String,
    moreText: {
      type: String,
      value: '查看更多'
    },
    showMore: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    onMore() {
      this.triggerEvent('more')
    }
  }
})
