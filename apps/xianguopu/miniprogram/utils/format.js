const { STATIC_BASE_URL } = require('../config/env');
function imageUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return `${STATIC_BASE_URL}${url}`;
}
function money(v) { return Number(v || 0).toFixed(2).replace(/\.00$/, ''); }
module.exports = { imageUrl, money };
