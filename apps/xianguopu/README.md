# 鲜果铺 Fresh Fruit Store

一套面向全国水果零售场景的微信小程序 + 管理后台 + API 服务端源码。

## 技术栈

- 微信小程序：原生 WXML / WXSS / JavaScript，Skyline + glass-easel，分包与按需注入
- 管理后台：Vue 3 + TypeScript + Vite + Pinia + Element Plus
- API：Node.js + TypeScript + Fastify + Prisma + PostgreSQL
- 本地基础设施：Docker Compose（PostgreSQL）

## 目录

```text
xianguopu/
├─ miniprogram/   微信小程序
├─ admin/         Web 管理后台
├─ server/        API / 数据库
├─ docker-compose.yml
└─ README.md
```

## 1. 启动数据库

```bash
docker compose up -d db
```

## 2. 启动 API

```bash
cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

默认 API：`http://127.0.0.1:8787`

默认管理员：

- 用户名：`admin`
- 密码：`FreshFruit@2026`

首次上线前请立即修改密码和 `JWT_SECRET`。

## 3. 启动后台

```bash
cd admin
npm install
npm run dev
```

默认后台：`http://127.0.0.1:5173`

## 4. 打开小程序

微信开发者工具导入 `miniprogram/`。

开发阶段：在“详情 → 本地设置”中关闭“不校验合法域名”限制，或将 API 部署到已备案 HTTPS 域名并配置到小程序服务器域名。

小程序 API 地址位于：

`miniprogram/config/env.js`

## 商品购买单位模型

单位没有写死。每个 SKU 独立定义：

- `unitName`：斤 / 公斤 / 克 / 个 / 盒 / 袋 / 箱 / 提 / 板 / 筐
- `specText`：例如 `500g/盒`、`5斤/箱`、`约2.5kg/个`
- `pricingMode`：`FIXED`（按份）或 `WEIGHT`（按重量单位）
- `minPurchase`：最小购买数量
- `step`：每次增减数量

示例：

- 草莓：`500g/盒`
- 苹果：`5斤/箱`
- 榴莲：`斤`，按重量计价
- 椰青：`个`
- 蓝莓：`125g/盒`
- 车厘子：`2.5kg/箱`

## 微信支付

源码默认 `PAYMENT_MODE=mock`，保证本地可以完整走通下单流程。真实微信支付涉及商户号、APIv3 Key、商户证书/私钥、回调域名等商户私密配置，应只放在服务端，不能写入小程序前端。

## 上线前建议

1. PostgreSQL 使用托管数据库并打开自动备份。
2. API 与图片使用 HTTPS/CDN。
3. 接入对象存储（COS/OSS）替代示例图。
4. 将微信 AppSecret、支付私钥全部放在服务端 Secret Manager。
5. 接入短信/物流/电子面单与正式微信支付。
6. 对订单创建、支付回调、库存扣减做幂等控制。
7. 对管理后台开启 MFA、IP 白名单或 SSO。
