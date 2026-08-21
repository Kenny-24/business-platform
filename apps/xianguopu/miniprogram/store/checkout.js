const KEY = 'xianguopu_direct_checkout_v1';
const MAX_AGE = 30 * 60 * 1000;

function normalize(item) {
  if (!item || !Number.isInteger(Number(item.skuId)) || Number(item.skuId) <= 0) return null;

  const quantity = Number(item.quantity);
  const price = Number(item.price);
  const stock = Number(item.stock);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(price) || price < 0) return null;
  if (!Number.isFinite(stock) || stock < quantity) return null;

  return {
    skuId: Number(item.skuId),
    productId: Number(item.productId),
    name: String(item.name || ''),
    imageUrl: String(item.imageUrl || ''),
    specText: String(item.specText || ''),
    unitName: String(item.unitName || ''),
    price,
    stock,
    quantity,
    minPurchase: Number(item.minPurchase || 1),
    step: Number(item.step || 1),
    checked: true
  };
}

function saveDirect(item) {
  const normalized = normalize(item);
  if (!normalized) return false;

  wx.setStorageSync(KEY, { item: normalized, createdAt: Date.now() });
  return true;
}

function getDirect() {
  const snapshot = wx.getStorageSync(KEY);
  if (!snapshot || Date.now() - Number(snapshot.createdAt || 0) > MAX_AGE) {
    clearDirect();
    return null;
  }

  const item = normalize(snapshot.item);
  if (!item) clearDirect();
  return item;
}

function clearDirect() {
  wx.removeStorageSync(KEY);
}

module.exports = { saveDirect, getDirect, clearDirect };
