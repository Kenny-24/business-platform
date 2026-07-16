# 花予商户管理后台 V2.1

本版本专注于简洁、高效的小清新管理界面。

## 主要变化

- 登录页取消背景图片，改为纯色简洁布局。
- 全站取消渐变、重阴影和装饰性大图。
- 使用浅绿、米白、灰白作为主色。
- 图鉴管理改为表格，不再使用大图卡片墙。
- 保留商品、轮播和图鉴的真实业务图片缩略图。
- 保留 CloudBase 邮箱登录、首次初始化和管理员权限校验。
- 统一按钮、表单、表格、弹窗、间距和状态提示。
- 错误提示会先关闭旧消息，避免连续堆叠。

## 覆盖前

请先备份原文件：

```text
huayu-admin-web/public/huayu-config.js
```

覆盖后，把旧文件中的 `accessKey` 复制到新文件。

## 启动

```bash
cd /Users/macz/WeChatProjects/huayu-miniapp/huayu-admin-web
npm install --no-audit --no-fund
npm run dev
```

浏览器访问：

```text
http://localhost:5173
```

## 构建

```bash
npm run build
```
