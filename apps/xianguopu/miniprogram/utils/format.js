const { STATIC_BASE_URL } = require('../config/env');
const { getFruitGuide } = require('../data/fruit-guide');

function imageUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return `${STATIC_BASE_URL}${url.startsWith('/') ? url : '/' + url}`;
}

function money(value) {
  const number = Number(value || 0);
  return number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function quantity(value) {
  return Number(value || 0).toFixed(3).replace(/\.?0+$/, '');
}

function firstSku(product) {
  return product && Array.isArray(product.skus) && product.skus.length ? product.skus[0] : null;
}

function decorateProduct(product) {
  if (!product) return null;
  const sku = firstSku(product) || {};
  const guide = getFruitGuide(product.name, product.category && product.category.name);
  const market = Number(sku.marketPrice || 0);
  const price = Number(sku.price || 0);
  return {
    ...product,
    displayImage: imageUrl(product.imageUrl),
    primarySku: sku,
    priceText: money(price),
    marketPriceText: market > price ? money(market) : '',
    originText: product.origin || '优选产区',
    varietyText: product.variety || '精选品种',
    freshnessLabel: '到货复检',
    seasonText: guide.seasonText,
    guide
  };
}

function decorateProducts(products) {
  return (products || []).map(item => decorateProduct(item)).filter(Boolean);
}

module.exports = { imageUrl, money, quantity, firstSku, decorateProduct, decorateProducts };
