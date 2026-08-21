import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mini = path.join(root, 'miniprogram');
const require = createRequire(import.meta.url);
let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(message);
}

function walk(directory, extension) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(full, extension));
    else if (!extension || entry.name.endsWith(extension)) result.push(full);
  }
  return result;
}

function checkSyntax(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert(result.status === 0, `${path.relative(root, file)} 语法错误\n${result.stderr}`);
}

function checkWxml(file) {
  const source = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  // WXML accepts input as a void element; image may be either paired or self-closing.
  const voidTags = new Set(['input']);
  const stack = [];
  const tokens = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '<') continue;
    let quote = '';
    for (let end = index + 1; end < source.length; end += 1) {
      const character = source[end];
      if ((character === '"' || character === "'") && (!quote || quote === character)) quote = quote ? '' : character;
      if (character === '>' && !quote) { tokens.push(source.slice(index, end + 1)); index = end; break; }
    }
  }
  for (const token of tokens) {
    const match = token.match(/^<\/?([a-zA-Z][\w-]*)/);
    if (!match) continue;
    const name = match[1];
    if (token.startsWith('</')) {
      assert(stack.pop() === name, `${path.relative(root, file)} 标签闭合顺序错误：${name}`);
    } else if (!token.endsWith('/>') && !voidTags.has(name)) stack.push(name);
  }
  assert(stack.length === 0, `${path.relative(root, file)} 存在未闭合标签：${stack.join(',')}`);
}

function checkWxss(file) {
  const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert(source.split('{').length === source.split('}').length, `${path.relative(root, file)} WXSS 大括号不平衡`);
}

for (const file of walk(mini, '.js')) checkSyntax(file);
for (const file of walk(mini, '.json')) JSON.parse(fs.readFileSync(file, 'utf8'));
for (const file of walk(mini, '.wxml')) checkWxml(file);
for (const file of walk(mini, '.wxss')) checkWxss(file);
JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));

const safeImageWxml = path.join(mini, 'components/safe-image/index.wxml');
for (const extension of ['js', 'json', 'wxml', 'wxss']) {
  assert(fs.existsSync(path.join(mini, `components/safe-image/index.${extension}`)), `安全图片组件缺失：${extension}`);
}
assert(fs.existsSync(path.join(mini, 'utils/image-cache.js')), '全局图片缓存模块缺失');
for (const file of walk(mini, '.wxml')) {
  const source = fs.readFileSync(file, 'utf8');
  if (file !== safeImageWxml) assert(!/<image\b/.test(source), `${path.relative(root, file)} 绕过了安全图片组件`);
  if (/<safe-image\b/.test(source)) {
    const configFile = file.replace(/\.wxml$/, '.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    assert(config.usingComponents && config.usingComponents['safe-image'], `${path.relative(root, file)} 未声明安全图片组件`);
  }
}

const scopedImageLayouts = [
  ['pages/home/index.wxml', 'home-cart-icon'],
  ['subpackages/search/index/index.wxml', 'trend-copy'],
  ['subpackages/order/detail/index.wxml', 'goods-main']
];
for (const [file, className] of scopedImageLayouts) {
  assert(fs.readFileSync(path.join(mini, file), 'utf8').includes(`class="${className}"`), `${file} 缺少图片相邻内容容器 ${className}`);
}
const unsafeImageSelectors = /(?:\.trend-item|\.goods)>view/;
for (const file of [
  'pages/home/index.wxss',
  'subpackages/search/index/index.wxss',
  'subpackages/order/detail/index.wxss'
]) {
  assert(!unsafeImageSelectors.test(fs.readFileSync(path.join(mini, file), 'utf8')), `${file} 存在会覆盖图片容器尺寸的通配子选择器`);
}

const appConfig = JSON.parse(fs.readFileSync(path.join(mini, 'app.json'), 'utf8'));
const pagePaths = [
  ...appConfig.pages,
  ...appConfig.subpackages.flatMap(pack => pack.pages.map(page => `${pack.root}/${page}`))
];
for (const page of pagePaths) {
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    assert(fs.existsSync(path.join(mini, `${page}.${extension}`)), `页面文件缺失：${page}.${extension}`);
  }
}

assert(appConfig.preloadRule['pages/home/index'].network === 'wifi', '首页商品详情分包必须仅在 Wi-Fi 下预加载');
assert(appConfig.preloadRule['pages/cart/index'].packages.includes('subpackages/order'), '购物车订单分包预加载丢失');
assert(pagePaths.length === 11, '精简后页面数量应为 11');
assert(!appConfig.subpackages.some(pack => pack.root === 'subpackages/discovery'), 'app.json 仍包含已删除的 discovery 分包');
assert(!fs.existsSync(path.join(mini, 'subpackages/discovery')), 'discovery 分包目录仍然存在');

const theme = fs.readFileSync(path.join(mini, 'styles/theme.wxss'), 'utf8');
for (const [selector, minimum] of [['eyebrow', 20], ['nav-kicker', 20], ['tag', 20]]) {
  const rule = theme.match(new RegExp(`\\.${selector}\\{([^}]*)\\}`));
  const size = rule && rule[1].match(/font-size:\s*(\d+)rpx/);
  assert(size && Number(size[1]) >= minimum, `${selector} 文字小于 ${minimum}rpx`);
}

function luminance(color) {
  const values = color.replace('#', '').match(/.{2}/g).map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

const muted = theme.match(/--muted:(#[0-9a-fA-F]{6})/)[1];
const cream = theme.match(/--cream:(#[0-9a-fA-F]{6})/)[1];
const contrast = (Math.max(luminance(muted), luminance(cream)) + 0.05)
  / (Math.min(luminance(muted), luminance(cream)) + 0.05);
assert(contrast >= 4.5, '辅助文字与暖白背景的对比度不足');

const homeMarkup = fs.readFileSync(path.join(mini, 'pages/home/index.wxml'), 'utf8');
assert(homeMarkup.includes('{{store.serviceArea}}') && homeMarkup.includes('{{store.deliveryPromise}}'), '首页履约信息没有从店铺设置动态读取');
assert(!homeMarkup.includes('上海 · 今日鲜达'), '首页仍然硬编码固定城市');
assert(homeMarkup.includes('class="home-cart"') && homeMarkup.includes('home-cart-badge'), '首页搜索区缺少果篮快捷入口或数量角标');
assert(homeMarkup.includes('class="delivery-strip"') && homeMarkup.includes('{{deliveryNotice}}'), '首页缺少真实配送时段提示条');
assert(homeMarkup.includes('class="scene-row"') && homeMarkup.includes('open-type="share"'), '首页四个圆形场景入口不完整');
assert(!/旬味档案|鲜一颗，都有来处|goSeasonal|goOrigins/.test(homeMarkup), '首页仍保留已删除的时令或产地专区');

const homeSource = fs.readFileSync(path.join(mini, 'pages/home/index.js'), 'utf8');
const deliverySlots = fs.readFileSync(path.join(mini, 'data/delivery-slots.js'), 'utf8');
assert(homeSource.includes("require('../../data/delivery-slots')"), '首页配送提示没有复用统一配送时段数据');
for (const slot of ['09:00–12:00', '14:00–17:00', '18:00–21:00']) {
  assert(deliverySlots.includes(slot), `统一配送时段缺失：${slot}`);
}

const productCardMarkup = fs.readFileSync(path.join(mini, 'components/product-card/index.wxml'), 'utf8');
const productCardSource = fs.readFileSync(path.join(mini, 'components/product-card/index.js'), 'utf8');
assert(productCardMarkup.includes('bookmark-glyph') && productCardSource.includes('favorite_product_'), '商品卡缺少可持久化收藏书签');
assert(productCardMarkup.includes('产地：{{view.originText}} · 时令：{{view.seasonText}}'), '商品卡未直接展示产地与时令');
assert(productCardMarkup.includes('view.marketPriceText') && productCardMarkup.includes('class="market"'), '商品卡缺少真实划线原价');

const categoryMarkup = fs.readFileSync(path.join(mini, 'pages/category/index.wxml'), 'utf8');
const categorySource = fs.readFileSync(path.join(mini, 'pages/category/index.js'), 'utf8');
assert(categoryMarkup.includes('class="filter-trigger"') && categoryMarkup.includes('filter-badge'), '分类页缺少带数量角标的筛选按钮');
assert(categoryMarkup.includes('class="filter-sheet"') && categorySource.includes('confirmFilter()'), '分类页缺少完整排序/筛选面板');
assert(!/回购榜|周销量|TOP\d/i.test(categoryMarkup), '分类页包含没有真实数据支撑的销量或榜单背书');

const cartMarkup = fs.readFileSync(path.join(mini, 'pages/cart/index.wxml'), 'utf8');
const cartSource = fs.readFileSync(path.join(mini, 'pages/cart/index.js'), 'utf8');
assert(cartMarkup.includes('trash-button') && !cartMarkup.includes('class="remove"'), '果篮删除操作没有改为步进器旁独立垃圾桶');
assert(cartMarkup.includes('为你推荐') && cartMarkup.includes('addRecommendation'), '果篮缺少横向推荐与快捷加购');
assert(cartMarkup.includes('仅按已勾选商品计算合计') && cartMarkup.includes('作为礼物精心包装'), '果篮误删商品勾选或礼赠能力');
assert(cartMarkup.includes('class="checkout-button"') && cartMarkup.includes('>结算</button>'), '果篮森林绿结算按钮缺失');
assert(cartSource.includes('api.products({ pageSize: 20 })'), '果篮推荐没有复用真实商品数据');

const profileMarkup = fs.readFileSync(path.join(mini, 'pages/profile/index.wxml'), 'utf8');
assert(profileMarkup.includes('class="menu-copy"') && !/service-grid|order-grid/.test(profileMarkup), '“我的”页仍使用旧宫格布局');
for (const label of ['我的订单', '收货地址', '联系水果顾问', '关于鲜果铺', '退出登录']) {
  assert(profileMarkup.includes(label), `“我的”页缺少竖排项目：${label}`);
}
assert(!/时令日历|产地档案/.test(profileMarkup), '“我的”页仍包含已删除的时令/产地入口');

const adminSettings = fs.readFileSync(path.join(root, 'admin/src/views/Settings.vue'), 'utf8');
assert(adminSettings.includes('form.serviceArea') && adminSettings.includes('form.deliveryPromise'), '后台无法编辑首页服务范围和履约说明');

const schema = fs.readFileSync(path.join(root, 'server/prisma/schema.prisma'), 'utf8');
assert(/isGift\s+Boolean\s+@default\(false\)/.test(schema), '订单缺少独立礼赠包装字段');
assert(/deliverySlot\s+String\?/.test(schema), '订单缺少独立配送时段字段');

const migration = fs.readFileSync(
  path.join(root, 'server/prisma/migrations/20260821090000_order_fulfillment/migration.sql'),
  'utf8'
);
assert(migration.includes('ADD COLUMN "isGift" BOOLEAN NOT NULL DEFAULT false'), '礼赠包装数据库迁移缺失');
assert(migration.includes('ADD COLUMN "deliverySlot" TEXT'), '配送时段数据库迁移缺失');
assert(migration.includes('regexp_split_to_table') && migration.includes('WITH ORDINALITY'), '旧订单备注兼容迁移缺失');

const orderRoute = fs.readFileSync(path.join(root, 'server/src/routes/user.ts'), 'utf8');
assert(orderRoute.includes('isGift: Boolean(b.isGift)'), '接口未保存礼赠包装字段');
assert(orderRoute.includes('deliverySlot: deliverySlot || null'), '接口未保存配送时段字段');
assert(orderRoute.includes('remark: remark || null'), '接口没有独立保存用户备注');

const ordersAdmin = fs.readFileSync(path.join(root, 'admin/src/views/Orders.vue'), 'utf8');
assert(ordersAdmin.includes('scope.row.isGift') && ordersAdmin.includes('gift-tag'), '后台订单列表缺少礼赠标记');
assert(ordersAdmin.includes('current.deliverySlot'), '后台订单详情缺少配送时段');
assert(ordersAdmin.includes('current.remark'), '后台订单详情缺少用户备注');

const requestSource = fs.readFileSync(path.join(mini, 'utils/request.js'), 'utf8');
const envSource = fs.readFileSync(path.join(mini, 'config/env.js'), 'utf8');
assert(!requestSource.includes('x-app-key') && !envSource.includes('APP_KEY'), '无效的应用鉴权请求头仍未移除');
assert(envSource.includes('10.123.92.32:8787'), '真机调试局域网地址被意外改动');

const serverEntry = fs.readFileSync(path.join(root, 'server/src/index.ts'), 'utf8');
const exampleEnv = fs.readFileSync(path.join(root, 'server/.env.example'), 'utf8');
assert(!/origin:\s*true/.test(serverEntry), 'CORS 仍然允许任意来源');
assert(serverEntry.includes('isAllowedOrigin') && exampleEnv.includes('CORS_ALLOWED_ORIGINS'), 'CORS 可配置白名单缺失');

const directDetail = fs.readFileSync(path.join(mini, 'subpackages/product/detail/index.js'), 'utf8');
const directMarkup = fs.readFileSync(path.join(mini, 'subpackages/product/detail/index.wxml'), 'utf8');
assert(directDetail.includes('checkout.saveDirect') && directDetail.includes('mode=direct'), '立即购买没有使用独立结算通道');
assert(directMarkup.includes('bindtap="buy"') && directMarkup.includes('立即购买'), '商品详情缺少可点击的立即购买按钮');

const checkoutSource = fs.readFileSync(path.join(mini, 'subpackages/order/checkout/index.js'), 'utf8');
const checkoutMarkup = fs.readFileSync(path.join(mini, 'subpackages/order/checkout/index.wxml'), 'utf8');
assert(checkoutSource.includes("require('../../../data/delivery-slots')"), '结算页没有复用统一配送时段数据');
assert(checkoutSource.includes('isGift: Boolean(this.data.giftEnabled)'), '结算页未提交结构化礼赠信息');
assert(checkoutSource.includes('deliverySlot: selectedSlot ? selectedSlot.time : null'), '结算页未提交结构化配送时段');
assert(!checkoutSource.includes('期望配送：'), '配送时段仍被拼接进用户备注');
assert(checkoutMarkup.includes('class="checkout-error"'), '结算页缺少可重试错误提示');

const retiredLabel = String.fromCodePoint(0x4e70, 0x624b);
for (const file of walk(root)) {
  if (!/\.(?:js|ts|vue|wxml|wxss|md)$/i.test(file)) continue;
  assert(!fs.readFileSync(file, 'utf8').includes(retiredLabel), `${path.relative(root, file)} 仍包含已停用的人物导购文案`);
}

const { GUIDES } = require(path.join(mini, 'data/fruit-guide.js'));
assert(Object.keys(GUIDES).length === 36, '水果指南应包含 36 款商品');
assert(Object.values(GUIDES).every(guide => typeof guide.seasonText === 'string' && guide.seasonText.length > 0), '水果指南缺少简化后的 seasonText');
const fruitGuideSource = fs.readFileSync(path.join(mini, 'data/fruit-guide.js'), 'utf8');
assert(!/\bmonths\s*:|isFruitInSeason/.test(fruitGuideSource), '水果指南仍保留复杂月份判断逻辑');
for (const file of walk(mini, '.js').concat(walk(mini, '.wxml'))) {
  const source = fs.readFileSync(file, 'utf8');
  assert(!/\binSeason\b|monthText/.test(source), `${path.relative(root, file)} 仍依赖旧月份判断结果`);
}

const storage = new Map();
const mockApp = { globalData: { token: '', user: null } };
let loginCalls = 0;
let meUnauthorized = false;
let imageRequestCalls = 0;
let storeRequestFails = false;
let addressRequestFails = false;
let mockAddresses = [{
  id: 11,
  receiver: '测试用户',
  phone: '13800000000',
  province: '天津市',
  city: '天津市',
  district: '和平区',
  detail: '测试地址 1 号',
  isDefault: true
}];
const submittedOrders = [];
const mockImageFiles = new Map();
globalThis.getApp = () => mockApp;
globalThis.wx = {
  env: { USER_DATA_PATH: 'wxfile://usr' },
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  setTabBarBadge() {},
  removeTabBarBadge() {},
  showToast() {},
  vibrateShort() {},
  navigateTo({ success }) { if (success) success(); },
  redirectTo({ success }) { if (success) success(); },
  switchTab({ success }) { if (success) success(); },
  getFileSystemManager() {
    return {
      access({ path: filePath, success, fail }) { (mockImageFiles.has(filePath) ? success : fail)(); },
      writeFile({ filePath, data, success }) { mockImageFiles.set(filePath, data); success(); },
      unlink({ filePath, complete }) { mockImageFiles.delete(filePath); complete(); }
    };
  },
  login({ success }) {
    loginCalls += 1;
    success({ code: `verify-code-${loginCalls}` });
  },
  request({ url, header, method = 'GET', data, success, fail }) {
    if (url.includes('/static/products/')) {
      imageRequestCalls += 1;
      return success({ statusCode: 200, data: new ArrayBuffer(64) });
    }
    if (url.endsWith('/auth/wx/login')) {
      return success({ statusCode: 200, data: { token: `verify-token-${loginCalls}`, user: { id: 7, nickname: '服务端用户' } } });
    }
    if (url.endsWith('/user/me')) {
      assert(header.Authorization === `Bearer ${storage.get('token')}`, '登录态请求未携带正确 Token');
      if (meUnauthorized) {
        meUnauthorized = false;
        return success({ statusCode: 401, data: { message: '登录已过期' } });
      }
      return success({ statusCode: 200, data: { id: 7, nickname: '服务端用户' } });
    }
    if (url.endsWith('/settings/store')) {
      if (storeRequestFails) {
        return success({ statusCode: 400, data: { message: '配送配置读取异常' } });
      }
      return success({
        statusCode: 200,
        data: {
          storeName: '鲜果铺',
          serviceArea: '天津',
          deliveryPromise: '当日送达',
          baseFreight: 8,
          freeShippingThreshold: 99
        }
      });
    }
    if (url.endsWith('/user/addresses')) {
      if (addressRequestFails) {
        return success({ statusCode: 400, data: { message: '地址服务暂不可用' } });
      }
      return success({ statusCode: 200, data: mockAddresses });
    }
    if (url.endsWith('/user/orders') && method === 'POST') {
      submittedOrders.push(structuredClone(data));
      return success({
        statusCode: 200,
        data: { order: { id: 700 + submittedOrders.length }, payment: { mode: 'mock', paid: true } }
      });
    }
    return fail({ errMsg: `unexpected request: ${url}` });
  }
};
const cart = require(path.join(mini, 'store/cart.js'));
cart.add({ skuId: 1, productId: 1, name: '苹果', price: 59.9, stock: 3, minPurchase: 1, step: 1 }, 1);
cart.add({ skuId: 1, productId: 1, name: '苹果', price: 59.9, stock: 3, minPurchase: 1, step: 1 }, 1);
assert(cart.count() === 2 && cart.getCart()[0].quantity === 2, '购物车累加行为异常');
cart.clearChecked();
assert(cart.count() === 0, '购物车清理行为异常');

const session = require(path.join(mini, 'utils/session.js'));
const [loginUserA, loginUserB] = await Promise.all([
  session.login({ nickName: '本地用户' }),
  session.login({ nickName: '本地用户' })
]);
assert(loginCalls === 1, '并发登录应合并为一次微信登录');
assert(loginUserA.nickName === '本地用户' && loginUserB.id === 7, '登录用户信息合并异常');
assert(session.isLoggedIn() && mockApp.globalData.token === 'verify-token-1', '登录态保存异常');
await session.ensureValid();
assert(loginCalls === 1, '有效登录态不应重复登录');
meUnauthorized = true;
const refreshedUser = await session.ensureValid({ nickName: '续期用户' });
assert(loginCalls === 2 && refreshedUser.nickName === '续期用户', '过期登录态自动续登异常');
session.clearSession();
assert(!session.isLoggedIn() && mockApp.globalData.user === null, '退出登录清理异常');

const imageCache = require(path.join(mini, 'utils/image-cache.js'));
const imageSource = 'http://10.123.92.32:8787/static/products/01.jpg';
const [cachedImageA, cachedImageB] = await Promise.all([
  imageCache.resolveImage(imageSource),
  imageCache.resolveImage(imageSource)
]);
assert(cachedImageA === cachedImageB && cachedImageA.startsWith('wxfile://usr/xianguopu-image-v2-'), '网络图片未转换为统一的本地缓存路径');
assert(imageRequestCalls === 1, '相同图片的并发请求应自动合并');
assert(await imageCache.resolveImage(imageSource) === cachedImageA && imageRequestCalls === 1, '已缓存图片不应重复下载');
await imageCache.invalidateImage(imageSource);
await imageCache.resolveImage(imageSource, { force: true });
assert(imageRequestCalls === 2, '图片重试应清理旧缓存并重新下载');
assert(await imageCache.resolveImage('/assets/tab/home.png') === '/assets/tab/home.png', '本地图片路径不应进入网络缓存');

const directCheckout = require(path.join(mini, 'store/checkout.js'));
const existingCartItem = {
  skuId: 18,
  productId: 18,
  name: '保留在果篮中的奇异果',
  imageUrl: '/static/products/18.jpg',
  specText: '6个装',
  unitName: '盒',
  price: 49.9,
  stock: 20,
  minPurchase: 1,
  step: 1
};
const directItem = {
  skuId: 5,
  productId: 5,
  name: '直接购买的凤梨',
  imageUrl: '/static/products/05.jpg',
  specText: '约1.5kg/个',
  unitName: '个',
  price: 29.9,
  stock: 10,
  minPurchase: 1,
  step: 1,
  quantity: 2
};

cart.add(existingCartItem, 1);
assert(directCheckout.saveDirect(directItem), '立即购买快照保存失败');
assert(directCheckout.getDirect().skuId === directItem.skuId, '立即购买快照读取失败');
assert(cart.count() === 1 && cart.getCart()[0].skuId === 18, '立即购买错误修改了现有果篮');
assert(!directCheckout.saveDirect({ ...directItem, quantity: 0 }), '无效立即购买数量未被拒绝');
assert(!directCheckout.saveDirect({ ...directItem, skuId: 0 }), '无效立即购买规格未被拒绝');

storage.set('xianguopu_direct_checkout_v1', {
  item: directItem,
  createdAt: Date.now() - 31 * 60 * 1000
});
assert(directCheckout.getDirect() === null, '过期立即购买快照没有被自动清理');
assert(directCheckout.saveDirect(directItem), '立即购买快照重新保存失败');

let checkoutPageDefinition = null;
globalThis.Page = definition => { checkoutPageDefinition = definition; };
require(path.join(mini, 'subpackages/order/checkout/index.js'));
assert(checkoutPageDefinition, '确认订单页面注册失败');

function createCheckoutPage(options) {
  const page = {
    ...checkoutPageDefinition,
    data: structuredClone(checkoutPageDefinition.data),
    setData(update) {
      Object.assign(this.data, update);
    }
  };
  page.onLoad(options);
  return page;
}

const directPage = createCheckoutPage({ mode: 'direct' });
await directPage.load(false);
assert(directPage.data.loaded && !directPage.data.error, '直接购买确认页加载失败');
assert(directPage.data.directPurchase, '直接购买确认页未识别独立模式');
assert(directPage.data.items.length === 1 && directPage.data.items[0].skuId === 5, '直接购买混入了果篮商品');
assert(directPage.data.total === '67.8', '直接购买金额与配送费计算异常');

directPage.setData({ giftEnabled: true, remark: '请保留完整果皮', slot: 'afternoon' });
await directPage.submit();
const directOrder = submittedOrders.at(-1);
assert(directOrder.items.length === 1 && directOrder.items[0].skuId === 5, '直接购买订单商品错误');
assert(directOrder.isGift === true, '礼赠开关没有写入独立订单字段');
assert(directOrder.deliverySlot === '14:00–17:00', '配送时段没有写入独立订单字段');
assert(directOrder.remark === '请保留完整果皮', '用户备注被系统礼赠或配送文案污染');
assert(directCheckout.getDirect() === null, '直接购买提交成功后未清理临时结算快照');
assert(cart.count() === 1 && cart.getCart()[0].skuId === 18, '直接购买提交后错误清空了果篮');

const cartPage = createCheckoutPage({});
await cartPage.load(false);
assert(cartPage.data.items.length === 1 && cartPage.data.items[0].skuId === 18, '果篮结算错误读取了直接购买快照');

addressRequestFails = true;
await cartPage.load(true);
assert(cartPage.data.loaded && cartPage.data.error.includes('收货地址加载失败'), '地址请求失败被误判为正常空地址');
const orderCountBeforeFailure = submittedOrders.length;
await cartPage.submit();
assert(submittedOrders.length === orderCountBeforeFailure, '结算数据失败时仍然允许提交订单');

addressRequestFails = false;
await cartPage.load(true);
assert(cartPage.data.loaded && !cartPage.data.error, '地址错误重试后没有恢复');

storeRequestFails = true;
await cartPage.load(true);
assert(cartPage.data.error.includes('店铺配送信息加载失败'), '店铺配送设置失败被静默回退为默认值');
storeRequestFails = false;
await cartPage.load(true);
assert(!cartPage.data.error && cartPage.data.address.id === 11, '配送设置重试后没有恢复');

mockAddresses = [];
await cartPage.load(true);
assert(cartPage.data.loaded && !cartPage.data.error && cartPage.data.address === null, '真实空地址与网络错误没有正确区分');
mockAddresses = [{
  id: 11,
  receiver: '测试用户',
  phone: '13800000000',
  province: '天津市',
  city: '天津市',
  district: '和平区',
  detail: '测试地址 1 号',
  isDefault: true
}];
await cartPage.load(true);
cartPage.setData({ remark: '放在前台', slot: 'evening', giftEnabled: false });
await cartPage.submit();
const cartOrder = submittedOrders.at(-1);
assert(cartOrder.items[0].skuId === 18 && cartOrder.isGift === false, '普通果篮结算提交内容错误');
assert(cartOrder.deliverySlot === '18:00–21:00' && cartOrder.remark === '放在前台', '普通结算没有分离配送时段与备注');
assert(cart.count() === 0, '普通果篮结算成功后没有移除已结算商品');

const productDir = path.join(root, 'server/public/products');
const productImages = fs.readdirSync(productDir).filter(name => /^\d{2}\.jpg$/.test(name));
assert(productImages.length === 36, '商品图应为 36 张 JPG');
for (const name of productImages) {
  const bytes = fs.readFileSync(path.join(productDir, name));
  assert(bytes.length > 20_000 && bytes[0] === 0xff && bytes[1] === 0xd8, `商品图损坏：${name}`);
}
assert(fs.statSync(path.join(root, 'server/public/banners/home-hero.jpg')).size > 20_000, '首页主视觉缺失');

const seed = fs.readFileSync(path.join(root, 'server/prisma/seed.ts'), 'utf8');
assert((seed.match(/^  \['/gm) || []).length === 36, '种子商品数量应为 36');

if (Number(process.versions.node.split('.')[0]) >= 24) {
  const domain = await import(pathToFileURL(path.join(root, 'server/src/domain/order-status.ts')).href);
  assert(domain.canTransitionOrder('PAID', 'PREPARING'), '已支付订单应可进入备货');
  assert(!domain.canTransitionOrder('COMPLETED', 'PAID'), '完成订单不得回退为已支付');
  assert(domain.shouldRestoreStock('PAID', 'CANCELLED'), '取消订单应回补库存');
  assert(!domain.shouldRestoreStock('CANCELLED', 'CANCELLED'), '重复取消不得重复回补库存');

  const corsDomain = await import(pathToFileURL(path.join(root, 'server/src/domain/cors-origin.ts')).href);
  const allowedOrigins = corsDomain.parseAllowedOrigins(
    'http://127.0.0.1:5173, http://10.123.92.32:5173, '
  );
  assert(corsDomain.isAllowedOrigin(undefined, allowedOrigins), '无 Origin 的微信小程序请求被 CORS 阻断');
  assert(corsDomain.isAllowedOrigin('http://127.0.0.1:5173', allowedOrigins), '本地管理后台来源被 CORS 阻断');
  assert(corsDomain.isAllowedOrigin('http://10.123.92.32:5173', allowedOrigins), '局域网管理后台来源被 CORS 阻断');
  assert(!corsDomain.isAllowedOrigin('https://untrusted.example', allowedOrigins), '非白名单来源被 CORS 意外放行');

  const { stripTypeScriptTypes } = await import('node:module');
  const capturedOrderWrites = [];
  const harnessSku = {
    id: 5,
    productId: 5,
    specText: '约1.5kg/个',
    unitName: '个',
    price: 29.9,
    stock: 10,
    minPurchase: 1,
    step: 1,
    product: {
      name: '海南金钻凤梨',
      imageUrl: '/static/products/05.jpg',
      status: 'ON_SALE'
    }
  };
  globalThis.__xianguopuOrderHarness = {
    config: { PAYMENT_MODE: 'mock' },
    createOrderNo: () => 'XGP-VERIFY-ORDER',
    prisma: {
      address: {
        async findFirst() {
          return {
            receiver: '测试用户',
            phone: '13800000000',
            province: '天津市',
            city: '天津市',
            district: '和平区',
            detail: '测试地址 1 号'
          };
        }
      },
      sku: { async findMany() { return [harnessSku]; } },
      setting: {
        async findUnique() {
          return { value: { baseFreight: 8, freeShippingThreshold: 99 } };
        }
      },
      async $transaction(execute) {
        return execute({
          sku: { async updateMany() { return { count: 1 }; } },
          order: {
            async create(payload) {
              capturedOrderWrites.push(payload);
              return { id: capturedOrderWrites.length, ...payload.data, items: payload.data.items.create };
            }
          }
        });
      }
    }
  };

  const routeModuleSource = stripTypeScriptTypes(orderRoute)
    .replace(
      "import { prisma } from '../lib/prisma.js';",
      'const { prisma } = globalThis.__xianguopuOrderHarness;'
    )
    .replace(
      "import { createOrderNo } from '../lib/order.js';",
      'const { createOrderNo } = globalThis.__xianguopuOrderHarness;'
    )
    .replace(
      "import { config } from '../config.js';",
      'const { config } = globalThis.__xianguopuOrderHarness;'
    );
  const routeModule = await import(`data:text/javascript,${encodeURIComponent(routeModuleSource)}`);
  const routeHandlers = new Map();
  const routeApp = {
    addHook() {},
    get(url, handler) { routeHandlers.set(`GET ${url}`, handler); },
    post(url, handler) { routeHandlers.set(`POST ${url}`, handler); },
    put(url, handler) { routeHandlers.set(`PUT ${url}`, handler); },
    delete(url, handler) { routeHandlers.set(`DELETE ${url}`, handler); }
  };
  await routeModule.userRoutes(routeApp);
  const createOrderRoute = routeHandlers.get('POST /orders');
  assert(typeof createOrderRoute === 'function', '服务端订单创建路由未注册');

  function createReply() {
    return {
      statusCode: 200,
      code(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      send(value) {
        return value;
      }
    };
  }

  const validOrderRequest = {
    user: { userId: 7, role: 'user' },
    body: {
      addressId: 11,
      items: [{ skuId: 5, quantity: 2 }],
      isGift: true,
      deliverySlot: '14:00–17:00',
      remark: '不要拆开外箱'
    }
  };
  const validReply = createReply();
  const createdOrder = await createOrderRoute(validOrderRequest, validReply);
  assert(validReply.statusCode === 200 && createdOrder.order.isGift === true, '服务端没有保存礼赠订单');
  assert(createdOrder.order.deliverySlot === '14:00–17:00', '服务端没有保存独立配送时段');
  assert(createdOrder.order.remark === '不要拆开外箱', '服务端污染或覆盖了用户备注');
  assert(Number(createdOrder.order.totalAmount) === 67.8, '服务端订单金额重算异常');
  assert(createdOrder.payment.mode === 'mock', '现有联调支付模式被意外改变');

  const badGiftReply = createReply();
  await createOrderRoute({
    ...validOrderRequest,
    body: { ...validOrderRequest.body, isGift: 'yes' }
  }, badGiftReply);
  assert(badGiftReply.statusCode === 400, '服务端没有拦截无效礼赠字段');

  const badSlotReply = createReply();
  await createOrderRoute({
    ...validOrderRequest,
    body: { ...validOrderRequest.body, deliverySlot: '明天任何时候' }
  }, badSlotReply);
  assert(badSlotReply.statusCode === 400, '服务端没有拦截无效配送时段');

  const badRemarkReply = createReply();
  await createOrderRoute({
    ...validOrderRequest,
    body: { ...validOrderRequest.body, remark: '果'.repeat(81) }
  }, badRemarkReply);
  assert(badRemarkReply.statusCode === 400, '服务端没有拦截超长订单备注');

  const legacyReply = createReply();
  const legacyOrder = await createOrderRoute({
    ...validOrderRequest,
    body: { addressId: 11, items: [{ skuId: 5, quantity: 1 }] }
  }, legacyReply);
  assert(legacyOrder.order.isGift === false && legacyOrder.order.deliverySlot === null, '旧客户端订单兼容性异常');
  assert(legacyOrder.order.remark === null, '空用户备注没有保持独立语义');
  delete globalThis.__xianguopuOrderHarness;

  for (const file of walk(path.join(root, 'server/src'), '.ts')) {
    if (file.endsWith('.d.ts')) continue;
    checkSyntax(file);
  }
  for (const file of walk(path.join(root, 'server/prisma'), '.ts')) checkSyntax(file);
  for (const file of walk(path.join(root, 'admin/src'), '.ts')) checkSyntax(file);

  for (const file of walk(path.join(root, 'admin/src'), '.vue')) {
    const source = fs.readFileSync(file, 'utf8');
    const script = source.match(/<script\b[^>]*>([\s\S]*?)<\/script>/);
    if (!script) continue;
    const stripped = stripTypeScriptTypes(script[1]);
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: stripped,
      encoding: 'utf8'
    });
    assert(result.status === 0, `${path.relative(root, file)} Vue/TypeScript 脚本语法错误\n${result.stderr}`);
  }
}

console.log(`鲜果铺源码校验通过：${pagePaths.length} 个页面、36 款商品、${assertions} 项断言。`);
