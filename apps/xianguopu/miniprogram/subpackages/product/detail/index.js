const api = require('../../../services/api');
const cart = require('../../../store/cart');
const checkout = require('../../../store/checkout');
const ui = require('../../../utils/ui');
const { decorateProduct, money, quantity } = require('../../../utils/format');

function originStory(origin, name) {
  if (/泰国|新西兰|智利|秘鲁/.test(origin)) return `${name}来自${origin}优势产区。我们关注品种、采收成熟度与冷链衔接，让长途而来的风味依然清晰。`;
  if (/新疆/.test(origin)) return `${origin}日照时间长、昼夜温差鲜明，为${name}积累了更集中而干净的甜味，到仓后再按果形与状态复选。`;
  return `来自${origin}核心种植带，从果形、香气与到货状态中筛选。我们不只看外观，更在意入口时是否处于好吃的阶段。`;
}

Page({
  data: {
    product: null,
    sku: null,
    qty: 1,
    qtyText: '1',
    subtotal: '0',
    loading: true,
    error: '',
    cartCount: 0,
    adding: false,
    buying: false,
    favorite: false,
    soldOut: false
  },
  onLoad(options) { this.productId = Number(options.id); this.load(); },
  onShow() { this.setData({ cartCount: Math.floor(cart.count()) }); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const raw = await api.product(this.productId);
      const product = decorateProduct(raw);
      const sku = product.primarySku;
      const qty = Number(sku.minPurchase || 1);
      product.originStory = originStory(product.originText, product.name);
      product.sweetWidth = Number(product.guide.sweetness || 0) * 10;
      product.juiceWidth = Number(product.guide.juiciness || 0) * 10;
      this.setData({
        product,
        sku,
        qty,
        qtyText: quantity(qty),
        subtotal: money(Number(sku.price) * qty),
        loading: false,
        favorite: Boolean(wx.getStorageSync(`favorite_product_${product.id}`)),
        soldOut: Number(sku.stock) <= 0
      });
      wx.setNavigationBarTitle({ title: product.name });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '商品档案加载失败' });
    }
  },
  retry() { this.load(); },
  updateQty(qty) { this.setData({ qty, qtyText: quantity(qty), subtotal: money(Number(this.data.sku.price) * qty) }); },
  selectSku(event) { const sku = this.data.product.skus.find(item => item.id === Number(event.currentTarget.dataset.id)); const qty = Number(sku.minPurchase || 1); this.setData({ sku, soldOut: Number(sku.stock) <= 0 }); this.updateQty(qty); ui.feedback(); },
  minus() { const min = Number(this.data.sku.minPurchase || 1); const next = Math.max(min, Number(this.data.qty) - Number(this.data.sku.step || 1)); if (next !== Number(this.data.qty)) { this.updateQty(next); ui.feedback(); } },
  plus() { const next = Math.min(Number(this.data.sku.stock), Number(this.data.qty) + Number(this.data.sku.step || 1)); if (next === Number(this.data.qty)) return wx.showToast({ title: '已达到可购库存', icon: 'none' }); this.updateQty(next); ui.feedback(); },
  favorite() { const favorite = !this.data.favorite; wx.setStorageSync(`favorite_product_${this.data.product.id}`, favorite); this.setData({ favorite }); ui.feedback(); wx.showToast({ title: favorite ? '已收藏这份风味' : '已取消收藏', icon: 'none' }); },
  purchaseItem() {
    const { product, sku, qty } = this.data;
    if (!product || !sku) return null;

    return {
      skuId: sku.id,
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      specText: sku.specText,
      unitName: sku.unitName,
      price: Number(sku.price),
      stock: Number(sku.stock),
      minPurchase: Number(sku.minPurchase || 1),
      step: Number(sku.step || 1),
      quantity: Number(qty)
    };
  },
  add(showToast) {
    if (this.data.adding || !this.data.product || Number(this.data.sku.stock) <= 0) return;
    this.setData({ adding: true });
    cart.add(this.purchaseItem(), this.data.qty);
    this.setData({ cartCount: Math.floor(cart.count()) });
    if (showToast !== false) ui.addedToast();
    setTimeout(() => this.setData({ adding: false }), 520);
  },
  buy() {
    if (this.data.buying || this.data.soldOut) return;
    if (!checkout.saveDirect(this.purchaseItem())) {
      return wx.showToast({ title: '商品信息已变化，请刷新后重试', icon: 'none' });
    }

    this.setData({ buying: true });
    ui.feedback('medium');
    if (!ui.navigate('/subpackages/order/checkout/index?mode=direct')) {
      checkout.clearDirect();
      this.setData({ buying: false });
      return;
    }

    setTimeout(() => this.setData({ buying: false }), 450);
  },
  goCart() { ui.navigate('/pages/cart/index', 'switchTab'); },
  onShareAppMessage() { const p = this.data.product; return p ? { title: `${p.name}｜${p.guide.taste}`, path: `/subpackages/product/detail/index?id=${p.id}`, imageUrl: p.displayImage } : { title: '鲜果铺' }; }
});
