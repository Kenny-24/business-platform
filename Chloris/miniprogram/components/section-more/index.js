Component({
  properties: {
    text: {
      type: String,
      value: '查看更多'
    },
    target: {
      type: String,
      value: ''
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('more', {
        target: this.data.target
      })
    }
  }
})
