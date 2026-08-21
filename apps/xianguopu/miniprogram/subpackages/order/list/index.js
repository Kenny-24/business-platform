const api = require('../../../services/api');
const ui = require('../../../utils/ui');
const { imageUrl, money, quantity } = require('../../../utils/format');
const STATUS_MAP = { PENDING_PAYMENT:'待付款', PAID:'待发货', PREPARING:'备货中', SHIPPED:'配送中', COMPLETED:'已完成', CANCELLED:'已取消', REFUNDING:'退款中', REFUNDED:'已退款' };
function dateText(value) { const date = new Date(value); const pad = number => String(number).padStart(2, '0'); return `${date.getFullYear()}.${pad(date.getMonth()+1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`; }

Page({
  data: { items: [], active: '', loading: true, refreshing: false, loaded: false, error: '', tabs: [{key:'',name:'全部'},{key:'PENDING_PAYMENT',name:'待付款'},{key:'PAID',name:'待发货'},{key:'SHIPPED',name:'配送中'},{key:'COMPLETED',name:'已完成'}] },
  onLoad(options) { this.setData({ active: options.status || '' }); },
  onShow() { this.load(); },
  async load() {
    const requestId = (this.requestId || 0) + 1; this.requestId = requestId;
    const initial = !this.data.loaded;
    this.setData({ loading: initial, refreshing: !initial, error: '' });
    try {
      const list = await api.orders(this.data.active === 'PAID' ? '' : this.data.active);
      if (requestId !== this.requestId) return;
      const visible = this.data.active === 'PAID' ? list.filter(order => order.status === 'PAID' || order.status === 'PREPARING') : list;
      const items = visible.map(order => ({ ...order, statusText: STATUS_MAP[order.status] || order.status, dateText: dateText(order.createdAt), totalText: money(order.totalAmount), quantityTotal: quantity(order.items.reduce((sum, item) => sum + Number(item.quantity), 0)), items: order.items.map(item => ({ ...item, img: imageUrl(item.imageUrl) })) }));
      this.setData({ items, loading: false, refreshing: false, loaded: true, error: '' });
    } catch (error) { if (requestId === this.requestId) this.setData({ loading: false, refreshing: false, error: error.message || '订单加载失败' }); }
  },
  selectTab(event) { const active = event.currentTarget.dataset.key; if (active === this.data.active) return; this.setData({ active }); this.load(); },
  retry() { this.load(); },
  open(event) { ui.navigate(`/subpackages/order/detail/index?id=${event.currentTarget.dataset.id}`); },
  browse() { ui.navigate('/pages/category/index', 'switchTab'); }
});
