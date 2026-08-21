const api = require('../../../services/api');
const ui = require('../../../utils/ui');

Page({
  data: { items: [], selectMode: false, loading: true, refreshing: false, loaded: false, error: '' },
  onLoad(options) { this.setData({ selectMode: options.select === '1' }); },
  onShow() { this.load(); },
  async load() {
    const initial = !this.data.loaded;
    this.setData({ loading: initial, refreshing: !initial, error: '' });
    try {
      const items = await api.addresses();
      this.setData({ items: items.map(item => ({ ...item, mark: String(item.receiver || '收').slice(0, 1) })), loading: false, refreshing: false, loaded: true });
    } catch (error) { this.setData({ loading: false, refreshing: false, error: error.message || '地址加载失败' }); }
  },
  retry() { this.load(); },
  add() { ui.navigate('/subpackages/address/edit/index'); },
  edit(event) { ui.navigate(`/subpackages/address/edit/index?id=${event.currentTarget.dataset.id}`); },
  choose(event) { if (!this.data.selectMode) return; wx.setStorageSync('checkout_address_id', Number(event.currentTarget.dataset.id)); ui.feedback(); wx.navigateBack(); }
});
