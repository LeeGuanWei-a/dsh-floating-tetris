# 🕹️ dsh-floating-tetris — DeepSeek Harness 悬浮俄罗斯方块（宿主常驻插件）

![screenshot](pic.png)

在 **DeepSeek Harness Web GUI** 上运行的毛玻璃风格、可拖动的悬浮俄罗斯方块。作为**宿主常驻 Client 插件**分发：部署方安装一次后，Web 会话始终可用，**无需每会话 `cordis_define` / `cordis_run`**。

功能：
- ☀️/🌙 深浅色主题切换
- 🏆 最近 10 局排行榜（按分数降序，localStorage 持久化，可清空）
- ▁ / ✕ 收起为标题条（自动暂停）、□ 还原
- 键盘全局操控 + 屏幕按钮双输入

## ✅ 运行环境（版本标识）

在以下版本上开发并实测（动态插件路径）通过：

| 组件 | 版本 |
|---|---|
| `@deepseek-ai/dsh`（Harness CLI / Web GUI） | **`0.1.2-rc.1`** |
| Web GUI 地址 | `http://127.0.0.1:3080` |
| 宿主 Client 插件依赖 | `shell.overlay`、`sidebar.footer.action`、`timer`（`inject: ['timer']`） |
| 插件形态 | **Host-resident Client Plugin（纯 Client 端，无 Host 行为）** |

> ⚠️ 装配机制（`dsh.client` 元数据包 + ModuleLoader 浏览器产物 + 宿主组合行）**绑定本版本 harness 的 Client 插件加载链**。在新版本上装配前请先核对三个插槽名、`timer` 服务契约与 `dsh-client-modules` 扫描约定是否仍一致。

## 📦 仓库结构

```
dsh-floating-tetris/
├── README.md              # 本说明
└── host-plugin/           # 宿主常驻插件包（唯一分发物）
    ├── package.json       # dsh.client 元数据 + exports + tsdown 脚本
    ├── tsdown.config.ts   # 构建 lib/index.js 与 lib/client.js
    ├── README.md          # 打包/装配/回滚手册
    └── src/
        ├── index.js       # node 半区：空 apply（纯 UI 插件模式）
        └── client.js      # 浏览器半区：引擎 + UI + inject/apply（游戏本体）
```

`src/client.js` 是完整的宿主 Client 插件源码：引擎逻辑、深浅主题、排行榜、收起/还原全在里面，无 TS、无 JSX、无 import/require 之外的依赖（仅 `react`），与宿主 `@deepseek-ai/dsh-client-*` 包同构。

## 🚀 如何装配（部署维护者）

常驻形态 = **部署配置**。完整步骤见 `host-plugin/README.md`，概要：

1. `cd host-plugin && npm install && npm run bundle` —— 产出 `lib/index.js` + `lib/client.js`（浏览器半区需宿主同款打包链产出 `window.__ModuleLoader__.load` 形态）；
2. 发布或打包 npm 包（`npm pack`），然后在**目标部署**上安装到 profile：

   ```sh
   # 在目标部署上，把包安装进指定 profile（命令转发给 pnpm，用法见 dsh --help）
   dsh plugin --profile web add @your-scope/dsh-client-ui-floating-tetris

   # 若用本地 tarball（先用 npm pack 生成 .tgz）：
   dsh plugin --profile web add ./dsh-client-ui-floating-tetris-0.1.0.tgz
   ```

3. 在宿主组合（Web 应用加载的那层）加一行：

```yaml
- id: floating-tetris
  name: '@your-scope/dsh-client-ui-floating-tetris'
```

4. 重启 Web，验证 `shell.overlay` 出现 `tetris-window`、`sidebar.footer.action` 出现 `tetris-launch`。

> 提示：`dsh plugin --profile <name>` 会把后续参数转发给 profile 目录里的 **pnpm**（`add` / `remove` / `ls` 等）。先 `dsh --help` 核对本机命令格式，再执行安装。

普通使用者无需任何操作——悬浮窗随 Web 启动即可用。

## 🎮 操作方式

| 键盘 | 屏幕按钮 | 操作 |
|---|---|---|
| `←` / `→` | ← → | 左右移动 |
| `↓` | ▼ | 软降（+1/格） |
| `↑` 或 `X` | ↻ | 旋转（带墙踢） |
| `Z` | — | 反向旋转 |
| `空格` | ⤓ | 硬降（+2/格） |
| `P` | Ⅱ | 暂停 / 继续 |

窗口标题栏：`▁`/`✕` 收起为标题条（自动暂停）、`🏆` 排行榜、`☀️/🌙` 深浅色；标题条上 `✕` 才是彻底隐藏（从侧栏或凭窗口状态可恢复，见下）。

键盘在悬浮窗打开期间**全局生效**，输入框 / 文本框打字不受干扰。

> 注：`sidebar.footer.action` 入口可能与宿主自带的 `cordis-panel` 同行而显得拥挤；主恢复路径依赖窗口自带的收起/还原（收起后仍保留一条可见标题栏），不依赖侧栏。

## 🏆 排行榜规则

- 每局 Game Over 自动记录 `{ 分数, 消行, 等级, 时间戳 }`；
- 保留最近 10 局，显示按分数从高到低，本局带 `←` 高亮；
- 存储于浏览器 `localStorage`（key `dsh.tetris.records.v1`）；清站点数据 / 无痕 / 换浏览器会丢（界面已注明"仅保存在本机浏览器"）；
- 排行榜视图可一键清空（两次点击确认）。

## 🧱 实现要点（供二次开发）

- 棋盘 10×20；7-bag 随机出块；旋转矩阵 + 简单墙踢（偏移 [0,-1,1,-2,2]）；
- 计分：消 1/2/3/4 行 = 100/300/500/800；软降 +1/格、硬降 +2/格；
- 每消 10 行升 1 级，下落间隔 = `max(90, 760 - (level-1)*70)` ms；
- 游戏循环用 `ctx.interval`（timer 服务，`inject: ['timer']`）；
- 渲染前 `normState` 归一化 state，防残缺数据崩溃；
- 窗口为 `position: fixed` 覆盖层（挂 `shell.overlay`），标题栏 pointer-capture 拖拽，边界限制在视口内；
- 副作用全部挂 React effect + Cordis Fiber，插件行移除即回收。

## 📄 许可证

MIT（与 DeepSeek Harness 一致）。可自由分发、修改。
