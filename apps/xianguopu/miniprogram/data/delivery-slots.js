const DELIVERY_SLOTS = [
  { key: 'morning', name: '上午', time: '09:00–12:00' },
  { key: 'afternoon', name: '下午', time: '14:00–17:00' },
  { key: 'evening', name: '晚间', time: '18:00–21:00' }
];

const DELIVERY_NOTICE = '支持上午、下午或晚间配送';
const DELIVERY_DETAIL = DELIVERY_SLOTS.map(item => `${item.name} ${item.time}`).join('；');

module.exports = { DELIVERY_SLOTS, DELIVERY_NOTICE, DELIVERY_DETAIL };
