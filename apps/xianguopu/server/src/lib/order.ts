import crypto from 'node:crypto';
export function createOrderNo() {
  const d = new Date();
  const p = (n: number, w=2) => String(n).padStart(w, '0');
  const date = `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(),3)}`;
  return `FG${date}${crypto.randomInt(100000, 999999)}`;
}
