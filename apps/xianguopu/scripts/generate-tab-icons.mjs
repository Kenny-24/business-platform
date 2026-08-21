import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!runtimeModules) throw error;
  sharp = require(path.join(runtimeModules, 'sharp'));
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'miniprogram', 'assets', 'tab');

const icons = {
  home: `<path d="M17 37L40.5 17L64 37"/><path d="M23 34V63H58V34"/><path d="M34 63V48H47V63"/>`,
  category: `<rect x="17" y="17" width="17" height="17" rx="4"/><rect x="47" y="17" width="17" height="17" rx="4"/><rect x="17" y="47" width="17" height="17" rx="4"/><rect x="47" y="47" width="17" height="17" rx="4"/>`,
  cart: `<path d="M16 34H65L59 61H22L16 34Z"/><path d="M28 34C29 24 33.5 18 40.5 18C47.5 18 52 24 53 34"/><path d="M30 44V52M41 44V52M52 44V52"/>`,
  user: `<circle cx="40.5" cy="27" r="10.5"/><path d="M20 64C21.5 50.5 29 44 40.5 44C52 44 59.5 50.5 61 64"/>`
};

function svg(body, color, active) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81"><g fill="none" stroke="${color}" stroke-width="${active ? 4.8 : 4.3}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

for (const [name, body] of Object.entries(icons)) {
  await sharp(Buffer.from(svg(body, '#898E89', false))).png().toFile(path.join(output, `${name}.png`));
  await sharp(Buffer.from(svg(body, '#2F5F47', true))).png().toFile(path.join(output, `${name}-active.png`));
}

console.log('底部导航图标已生成：4 组 / 8 张 PNG');
