# 花予商户管理后台 V3.0

```bash
npm ci --no-audit --no-fund --progress=false
npm run dev
```

首次覆盖后，将旧项目中的 Publishable Key 填回：

```text
public/huayu-config.js
```

生产部署前执行：

```bash
npm run build
```

构建结果会生成在 `dist/`。交付包不附带旧版构建产物，避免源代码与 `dist` 版本不一致。
