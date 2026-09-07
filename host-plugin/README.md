# host-plugin — 宿主常驻装配手册

这是 `dsh-floating-tetris` 的**宿主常驻 Client 插件包**。部署方把本包装进目标
DeepSeek Harness 部署后，Web 会话中始终有悬浮俄罗斯方块，使用者**不需要**
任何每会话激活步骤（没有 `cordis_define` / `cordis_run`）。

> 行为与数据：悬浮窗默认弹出、可拖动、深浅主题、排行榜（localStorage
> `dsh.tetris.records.v1`）、收起/还原——全部与项目早期"动态插件"实测版本一致；
> 动态形态与 Run 卡片入口（`tool.view.cordis`）在本包中已去除。

## 目录

```
host-plugin/
├── package.json        # dsh.client 元数据 + exports（./client）+ tsdown 脚本
├── tsdown.config.ts    # entry: index（node 半区）、client（浏览器半区）
├── README.md           # 本手册
└── src/
    ├── index.js        # node 半区：空 apply（纯 UI 插件，host 侧无行为）
    └── client.js       # 浏览器半区：完整引擎 + UI + inject/apply（游戏本体）
```

## 打包

浏览器半区必须呈现宿主加载器要求的 `window.__ModuleLoader__.load({ id, factory })`
形态。该包装由宿主自带的客户端打包链生成——**请在目标部署的构建环境内执行**，
不要认为裸 tsdown 就能产出与宿主一致的可加载产物（可对照任意
`@deepseek-ai/dsh-client-ui-*` 包的 `lib/client.js` 头部）：

```sh
cd host-plugin
npm install            # 安装 tsdown 等构建依赖
npm run bundle         # 产出 lib/index.js 与 lib/client.js
npm pack               # 打 tarball，发布或直接安装
```

> 本项目 devDependencies 里的 `tsdown` 仅为占位：若宿主使用的是私有
> client 打包器/包装步骤，请按其要求配置（替换本文件即可）。

## 装配（部署维护者）

1. 让包可被目标部署解析：把发布产物安装进该部署的插件解析路径
   （`node_modules/@your-scope/dsh-client-ui-floating-tetris/...`）。
2. 在宿主组合中、Web 应用加载的那一层（与 `@deepseek-ai/dsh-client-ui-*`
   相同的行集，即部署自己的 patch）新增一行：

```yaml
- id: floating-tetris
  name: '@your-scope/dsh-client-ui-floating-tetris'
```

3. 重启 Web。`package.json` 的 `dsh.client` 元数据会被 `dsh-client-modules`
   扫描进浏览器 roster（`window.__DSH_BOOT__`），与宿主自身 client 插件一致。
4. 验证：页面出现悬浮窗；Inspect 中
   `Slots.listSubTree` → `shell.overlay` 有 occupant `tetris-window`、
   `sidebar.footer.action` 有 `tetris-launch`。

## 插件使用的宿主接口

| 接口 | 契约 |
|---|---|
| `shell.overlay` | `list`；id `tetris-window`，order 10 |
| `sidebar.footer.action` | `list`；id `tetris-launch`，order 5（可能与宿主 `cordis-panel` 同行而拥挤） |
| `timer` | 浏览器 ctx 上的 `timer` 服务，插件 `inject: ['timer']`，`ctx.interval` 驱动时钟 |

`tool.view.cordis`（key `self`）**不属于**宿主常驻插件——它是动态 Run 卡片专用，已移除。

## 回滚

移除宿主组合行并卸载包。不写任何会话数据；`localStorage` 的
`dsh.tetris.records.v1` 保留在用户浏览器，直到其清除站点数据。
