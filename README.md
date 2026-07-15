# 花予小程序 V2.0 全量项目

本项目包含：

- `miniprogram/`：顾客端微信小程序；
- `cloudfunctions/getHomeData/`：公开首页数据和私有图片临时地址；
- `cloudfunctions/adminApi/`：Web 商户后台统一管理员 API；
- `huayu-admin-web/`：Vue 3 商户管理后台；
- `docs/`：安装、部署与数据结构说明。

## 覆盖时必须保留

下面两个文件包含你的 AppID 和本机设置，本压缩包不会替换它们：

```text
project.config.json
project.private.config.json
```

将本包中的 `miniprogram`、`cloudfunctions`、`huayu-admin-web`、`docs` 复制到现有项目根目录，覆盖同名代码文件即可。

环境 ID 已配置为：

```text
cloudbase-d6gspds9z5e38b6f0
```

详细步骤请阅读 `docs/01-完整覆盖与启动.md`。
