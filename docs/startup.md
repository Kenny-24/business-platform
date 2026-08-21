# 启动指南

## 鲜花小程序 Chloris

本次交付未修改 Chloris 的样式、功能与目录内容。

1. 使用微信开发者工具导入 `apps/chloris`。
2. 后端与管理端按 `apps/chloris/README.md` 的原项目说明启动。

## 鲜果铺 Xianguopu

### 源码自检（可选但推荐）

```bash
cd apps/xianguopu
node scripts/verify.mjs
```

该命令无需安装第三方依赖，会检查小程序页面、配置、商品素材、购物车行为与订单状态机关键规则。

### 数据库与 API

```bash
cd apps/xianguopu
docker compose up -d db

cd server
cp .env.example .env       # 如果 .env 已存在则跳过
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

API 默认运行在 `http://127.0.0.1:8787`。

### 管理后台

```bash
cd apps/xianguopu/admin
npm install
npm run dev
```

后台默认运行在 `http://127.0.0.1:5173`。

### 微信小程序

微信开发者工具导入 `apps/xianguopu`。项目配置会自动把 `miniprogram/` 识别为小程序源码目录。

小程序请求地址位于 `apps/xianguopu/miniprogram/config/env.js`。模拟器可用 `127.0.0.1`；真机需换成电脑局域网 IP，生产环境需使用 HTTPS 合法域名。

更完整的环境、登录、支付和上线说明见 `apps/xianguopu/README.md`。
