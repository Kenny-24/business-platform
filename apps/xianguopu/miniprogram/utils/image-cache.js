const MAX_CONCURRENT = 4;
const REQUEST_TIMEOUT = 15000;
const CACHE_PREFIX = 'xianguopu-image-v2-';

const memoryCache = Object.create(null);
const pending = Object.create(null);
const queue = [];
let activeCount = 0;

function isRemoteUrl(url) {
  return /^https?:\/\//i.test(String(url || ''));
}

function hashUrl(value) {
  let hash = 2166136261;
  const source = String(value || '');
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function extensionOf(url) {
  const pathname = String(url || '').split('?')[0].split('#')[0];
  const match = pathname.match(/\.(jpe?g|png|webp|gif)$/i);
  if (!match) return '.jpg';
  return `.${match[1].toLowerCase().replace('jpeg', 'jpg')}`;
}

function cachePath(url) {
  return `${wx.env.USER_DATA_PATH}/${CACHE_PREFIX}${hashUrl(url)}${extensionOf(url)}`;
}

function runQueued(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    drainQueue();
  });
}

function drainQueue() {
  while (activeCount < MAX_CONCURRENT && queue.length) {
    const entry = queue.shift();
    activeCount += 1;
    Promise.resolve()
      .then(entry.task)
      .then(entry.resolve, entry.reject)
      .then(() => {
        activeCount -= 1;
        drainQueue();
      });
  }
}

function fileExists(filePath) {
  return new Promise(resolve => {
    wx.getFileSystemManager().access({
      path: filePath,
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

function removeFile(filePath) {
  return new Promise(resolve => {
    if (!filePath || filePath.indexOf(`${wx.env.USER_DATA_PATH}/${CACHE_PREFIX}`) !== 0) {
      resolve();
      return;
    }
    wx.getFileSystemManager().unlink({ filePath, complete: () => resolve() });
  });
}

function requestBytes(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: REQUEST_TIMEOUT,
      success(response) {
        const status = Number(response.statusCode || 0);
        const data = response.data;
        if (status >= 200 && status < 300 && data && Number(data.byteLength || 0) > 0) {
          resolve(data);
          return;
        }
        reject(new Error(`图片请求失败（HTTP ${status || '未知'}）`));
      },
      fail(error) {
        reject(new Error((error && error.errMsg) || '图片请求失败'));
      }
    });
  });
}

function writeFile(filePath, data) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath,
      data,
      success: () => resolve(filePath),
      fail: error => reject(new Error((error && error.errMsg) || '图片缓存写入失败'))
    });
  });
}

async function invalidateImage(url) {
  if (!isRemoteUrl(url)) return;
  const filePath = memoryCache[url] || cachePath(url);
  delete memoryCache[url];
  await removeFile(filePath);
}

function resolveImage(url, options) {
  const source = String(url || '');
  const force = Boolean(options && options.force);
  if (!source || !isRemoteUrl(source)) return Promise.resolve(source);
  if (pending[source]) return pending[source];

  const promise = (async () => {
    const filePath = cachePath(source);
    if (force) await invalidateImage(source);
    if (!force && memoryCache[source]) return memoryCache[source];
    if (!force && await fileExists(filePath)) {
      memoryCache[source] = filePath;
      return filePath;
    }
    const bytes = await runQueued(() => requestBytes(source));
    await writeFile(filePath, bytes);
    memoryCache[source] = filePath;
    return filePath;
  })();

  pending[source] = promise;
  promise.then(
    () => { delete pending[source]; },
    () => { delete pending[source]; }
  );
  return promise;
}

module.exports = { resolveImage, invalidateImage, isRemoteUrl };
