const { resolveImage, invalidateImage } = require('../../utils/image-cache');

Component({
  properties: {
    src: { type: String, value: '' },
    mode: { type: String, value: 'aspectFill' },
    lazy: { type: Boolean, value: true },
    retryable: { type: Boolean, value: true }
  },
  data: {
    displaySrc: '',
    ready: false,
    loading: false,
    failed: false
  },
  observers: {
    src(value) { this.prepare(value, false); }
  },
  lifetimes: {
    attached() {
      this._loadToken = this._loadToken || 0;
      this._activeSource = this._activeSource || '';
      this._decodeRetried = Boolean(this._decodeRetried);
      if (this.data.src && !this.data.loading && !this.data.displaySrc) {
        this.prepare(this.data.src, false);
      }
    },
    detached() {
      this._loadToken = (this._loadToken || 0) + 1;
    }
  },
  methods: {
    async prepare(value, force) {
      const source = String(value || '');
      if (source !== this._activeSource) {
        this._activeSource = source;
        this._decodeRetried = false;
      }
      const token = (this._loadToken || 0) + 1;
      this._loadToken = token;
      if (!source) {
        this.setData({ displaySrc: '', ready: false, loading: false, failed: false });
        return;
      }
      this.setData({ displaySrc: '', ready: false, loading: true, failed: false });
      try {
        const localPath = await resolveImage(source, { force: Boolean(force) });
        if (token !== this._loadToken) return;
        this.setData({ displaySrc: localPath, loading: false, failed: false });
      } catch (error) {
        if (token !== this._loadToken) return;
        console.warn('安全图片本地化失败，尝试原地址', { url: source, message: error.message });
        this.setData({ displaySrc: source, loading: false, failed: false });
      }
    },
    handleLoad() {
      this.setData({ ready: true, loading: false, failed: false });
      this.triggerEvent('load');
    },
    async handleError() {
      const source = String(this.data.src || '');
      if (source && this.data.displaySrc !== source && !this._decodeRetried) {
        this._decodeRetried = true;
        await invalidateImage(source);
        this.prepare(source, true);
        return;
      }
      this.setData({ ready: false, loading: false, failed: true });
      this.triggerEvent('error', { src: source });
    },
    async retry() {
      if (!this.data.retryable || !this.data.src) return;
      this._decodeRetried = false;
      await invalidateImage(this.data.src);
      this.prepare(this.data.src, true);
    }
  }
});
