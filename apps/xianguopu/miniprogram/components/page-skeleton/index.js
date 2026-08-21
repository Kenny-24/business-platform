Component({
  options: { virtualHost: true },
  properties: { type: { type: String, value: 'list' } },
  data: { four: [0, 1, 2, 3], three: [0, 1, 2] }
});
