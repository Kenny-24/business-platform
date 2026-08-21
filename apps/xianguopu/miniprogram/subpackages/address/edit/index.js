const api = require('../../../services/api');
const ui = require('../../../utils/ui');

Page({
  data: { id: 0, receiver: '', phone: '', region: ['北京市','北京市','朝阳区'], detail: '', isDefault: true, loading: false, saving: false, deleting: false, error: '', formError: '' },
  async onLoad(options) {
    const id = Number(options.id || 0);
    this.setData({ id, loading: Boolean(id) });
    wx.setNavigationBarTitle({ title: id ? '编辑收货地址' : '新增收货地址' });
    if (!id) return;
    try {
      const list = await api.addresses();
      const address = list.find(item => item.id === id);
      if (!address) throw new Error('未找到这个地址');
      this.setData({ receiver: address.receiver, phone: address.phone, region: [address.province,address.city,address.district], detail: address.detail, isDefault: address.isDefault, loading: false });
    } catch (error) { this.setData({ loading: false, error: error.message || '地址加载失败' }); }
  },
  retry() { this.onLoad({ id: this.data.id }); },
  field(event) { this.setData({ [event.currentTarget.dataset.key]: event.detail.value, formError: '' }); },
  region(event) { this.setData({ region: event.detail.value, formError: '' }); },
  toggle(event) { this.setData({ isDefault: event.detail.value }); },
  validate() {
    if (!String(this.data.receiver).trim()) return '请填写收货人';
    if (!/^1\d{10}$/.test(String(this.data.phone))) return '请填写正确的 11 位手机号';
    if (!this.data.region || this.data.region.length < 3) return '请选择所在地区';
    if (String(this.data.detail).trim().length < 3) return '请填写完整的街道与门牌信息';
    return '';
  },
  async save() {
    if (this.data.saving || this.data.deleting) return;
    const formError = this.validate();
    if (formError) { this.setData({ formError }); return wx.showToast({ title: formError, icon: 'none' }); }
    const data = this.data;
    const payload = { receiver: data.receiver.trim(), phone: data.phone, province: data.region[0], city: data.region[1], district: data.region[2], detail: data.detail.trim(), isDefault: data.isDefault };
    this.setData({ saving: true, formError: '' });
    try { data.id ? await api.updateAddress(data.id, payload) : await api.createAddress(payload); ui.feedback('medium'); wx.showToast({ title: '地址已保存', icon: 'none' }); setTimeout(() => wx.navigateBack(), 320); }
    catch (error) { this.setData({ formError: error.message || '保存失败，请重试' }); wx.showToast({ title: error.message || '保存失败', icon: 'none' }); }
    finally { this.setData({ saving: false }); }
  },
  remove() {
    if (this.data.deleting || this.data.saving) return;
    wx.showModal({ title: '删除这个地址？', content: '删除后无法恢复', confirmText: '删除', confirmColor: '#E96D3D', success: async result => {
      if (!result.confirm) return;
      this.setData({ deleting: true });
      try { await api.deleteAddress(this.data.id); ui.feedback('medium'); wx.showToast({ title: '已删除', icon: 'none' }); setTimeout(() => wx.navigateBack(), 320); }
      catch (error) { wx.showToast({ title: error.message || '删除失败', icon: 'none' }); }
      finally { this.setData({ deleting: false }); }
    } });
  }
});
