const api = require('../../../services/api');
const ui = require('../../../utils/ui');
const { imageUrl, money, quantity } = require('../../../utils/format');

const STATUS_MAP = {
  PENDING_PAYMENT: ['等待付款', '订单已创建，请完成付款'],
  PAID: ['等待发货', '果品将妥善打包后发出'],
  PREPARING: ['正在备货', '水果顾问正在准备本次果单'],
  SHIPPED: ['配送途中', '好果正在向你靠近'],
  COMPLETED: ['订单完成', '感谢选择鲜果铺'],
  CANCELLED: ['订单已取消', '本次订单已关闭'],
  REFUNDING: ['售后处理中', '水果顾问会尽快跟进'],
  REFUNDED: ['退款完成', '款项已按原路径退回']
};
const STATUS_INDEX = { PENDING_PAYMENT: 0, PAID: 1, PREPARING: 1, SHIPPED: 2, COMPLETED: 3 };

function dateText(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  data: { order: null, loading: true, error: '', steps: ['已下单', '准备果单', '配送中', '已完成'] },
  onLoad(options) { this.orderId = Number(options.id); this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const order = await api.order(this.orderId);
      const status = STATUS_MAP[order.status] || [order.status, ''];
      order.statusText = status[0];
      order.statusDesc = status[1];
      order.statusIndex = STATUS_INDEX[order.status] == null ? -1 : STATUS_INDEX[order.status];
      order.createdText = dateText(order.createdAt);
      order.paidText = dateText(order.paidAt);
      order.subtotalText = money(order.subtotal);
      order.freightText = money(order.freight);
      order.totalText = money(order.totalAmount);
      order.items = order.items.map(item => ({
        ...item,
        img: imageUrl(item.imageUrl),
        quantityText: quantity(item.quantity),
        priceText: money(item.price),
        amountText: money(item.amount)
      }));
      this.setData({ order, loading: false });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '订单加载失败' });
    }
  },
  retry() { this.load(); },
  copyNo() { ui.feedback(); wx.setClipboardData({ data: this.data.order.orderNo }); }
});
