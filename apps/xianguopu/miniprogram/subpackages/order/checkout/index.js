const api = require('../../../services/api');
const cart = require('../../../store/cart');
const checkout = require('../../../store/checkout');
const ui = require('../../../utils/ui');
const { imageUrl, money, quantity } = require('../../../utils/format');
const session = require('../../../utils/session');
const { DELIVERY_SLOTS } = require('../../../data/delivery-slots');

function readableError(label, error) {
  const detail = error && error.message ? error.message : '请检查网络后重试';
  return new Error(`${label}加载失败：${detail}`);
}

Page({
  data: {
    items: [],
    address: null,
    subtotal: '0',
    freight: '0',
    total: '0',
    remark: '',
    submitting: false,
    loading: true,
    refreshing: false,
    loaded: false,
    error: '',
    directPurchase: false,
    freeShippingThreshold: 99,
    baseFreight: 8,
    giftEnabled: false,
    slots: DELIVERY_SLOTS,
    slot: 'morning'
  },

  onLoad(options = {}) {
    this.purchaseMode = options.mode === 'direct' ? 'direct' : 'cart';
    this.setData({ directPurchase: this.purchaseMode === 'direct' });
  },

  onShow() {
    this.load(false);
  },

  async load(force) {
    if (this.loadingPromise) return this.loadingPromise;

    const initial = !this.data.loaded;
    this.setData({
      loading: initial,
      refreshing: !initial,
      error: '',
      giftEnabled: Boolean(wx.getStorageSync('checkout_gift_enabled'))
    });

    this.loadingPromise = this.performLoad(initial, Boolean(force)).finally(() => {
      this.loadingPromise = null;
    });
    return this.loadingPromise;
  },

  async performLoad(initial, force) {
    try {
      await session.ensureValid();

      const directItem = this.purchaseMode === 'direct' ? checkout.getDirect() : null;
      const rawItems = this.purchaseMode === 'direct'
        ? (directItem ? [directItem] : [])
        : cart.getCart().filter(item => item.checked);

      if (!rawItems.length) {
        if (this.purchaseMode === 'direct') {
          throw new Error('立即购买信息已过期，请返回商品页重新选择');
        }

        this.setData({ loading: false, refreshing: false });
        ui.navigate('/pages/cart/index', 'switchTab');
        return;
      }

      const items = rawItems.map(item => ({
        ...item,
        img: imageUrl(item.imageUrl),
        quantityText: quantity(item.quantity),
        priceText: money(item.price),
        amountText: money(Number(item.price) * Number(item.quantity))
      }));
      const subtotalNumber = rawItems.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0
      );

      const [settings, addresses] = await Promise.all([
        api.storeSettings(force).catch(error => {
          throw readableError('店铺配送信息', error);
        }),
        api.addresses().catch(error => {
          throw readableError('收货地址', error);
        })
      ]);

      if (!settings || typeof settings !== 'object') {
        throw new Error('店铺配送信息格式异常，请稍后重试');
      }
      if (!Array.isArray(addresses)) {
        throw new Error('收货地址数据格式异常，请稍后重试');
      }

      const threshold = Number(settings.freeShippingThreshold ?? 99);
      const baseFreight = Number(settings.baseFreight ?? 8);
      if (!Number.isFinite(threshold) || threshold < 0 || !Number.isFinite(baseFreight) || baseFreight < 0) {
        throw new Error('店铺配送费用配置异常，请稍后重试');
      }
      const freightNumber = subtotalNumber >= threshold ? 0 : baseFreight;
      const selectedId = Number(wx.getStorageSync('checkout_address_id') || 0);
      wx.removeStorageSync('checkout_address_id');
      const address = addresses.find(item => item.id === selectedId)
        || addresses.find(item => item.isDefault)
        || addresses[0]
        || null;

      this.setData({
        items,
        address,
        subtotal: money(subtotalNumber),
        freight: money(freightNumber),
        total: money(subtotalNumber + freightNumber),
        freeShippingThreshold: threshold,
        baseFreight,
        loading: false,
        refreshing: false,
        loaded: true,
        error: ''
      });
    } catch (error) {
      this.setData({
        loading: false,
        refreshing: false,
        error: error.message || '订单信息加载失败',
        loaded: !initial && this.data.loaded
      });
    }
  },

  retry() {
    this.load(true);
  },

  chooseAddress() {
    ui.navigate('/subpackages/address/list/index?select=1');
  },

  selectSlot(event) {
    this.setData({ slot: event.currentTarget.dataset.key });
    ui.feedback();
  },

  toggleGift(event) {
    const giftEnabled = Boolean(event.detail.value);
    wx.setStorageSync('checkout_gift_enabled', giftEnabled);
    this.setData({ giftEnabled });
  },

  remark(event) {
    this.setData({ remark: event.detail.value });
  },

  async submit() {
    if (this.data.submitting || this.data.error) return;
    if (!this.data.address) {
      return wx.showToast({ title: '请先添加收货地址', icon: 'none' });
    }

    const selectedSlot = this.data.slots.find(item => item.key === this.data.slot);
    const payload = {
      addressId: this.data.address.id,
      items: this.data.items.map(item => ({
        skuId: item.skuId,
        quantity: item.quantity
      })),
      remark: String(this.data.remark || '').trim(),
      isGift: Boolean(this.data.giftEnabled),
      deliverySlot: selectedSlot ? selectedSlot.time : null
    };

    this.setData({ submitting: true });
    try {
      const result = await api.createOrder(payload);
      if (this.purchaseMode === 'direct') checkout.clearDirect();
      else cart.clearChecked();

      wx.removeStorageSync('checkout_gift_enabled');
      ui.feedback('medium');
      wx.showToast({
        title: result.payment && result.payment.paid ? '下单成功' : '订单已创建',
        icon: 'none'
      });
      setTimeout(() => {
        ui.navigate(`/subpackages/order/detail/index?id=${result.order.id}`, 'redirectTo');
      }, 350);
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
