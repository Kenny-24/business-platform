Component({
  properties: {
    item: { type: Object, value: {} },
    compact: { type: Boolean, value: false },
    showAdd: { type: Boolean, value: true }
  },
  methods: {
    add() { this.triggerEvent('add', { item: this.data.item }) },
    open() { this.triggerEvent('open', { item: this.data.item }) }
  }
})
