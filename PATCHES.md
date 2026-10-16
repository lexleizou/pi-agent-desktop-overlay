# pi-agent-desktop — Follow-up Suggestions + Ghost Text + Co-Work Panel 补丁包

第一期：回复结束后自动生成 follow-up 建议 chips（进阶版 / ChatGPT 式“搭便车”实现）。
第二期：composer ghost text——输入时按历史前缀匹配的内联补全（Tab 采纳）。
第三期：Co-Work 面板——cowork 扩展（task_list / set_context 工具）+ 侧栏 Progress /
Context / Memory 分区 + 模型选择器两项（长名完整显示、供应商递进菜单）。
**第三期的 Co-Work 面板部分已于第六期整体移除**（与五期 pi-todos 面板重复）；
模型选择器两项保留。
视觉层采用 open-claude-ui 提取的 CDS（Claude Design System）token 子集。
第四期（同日追加）：流式 t/s 徽章对比度修复；上下文用量数字常显（环旁
`pct% / window`，不再只靠慢速 hover）；回合结束 usage 行补 cache hit % 与
平均 t/s（基于 pi-ai `AssistantMessage.durationMs`）。
第五期（同日追加）：pi-todos 任务清单改为右上角浮动面板（仿 Claude Cowork，
不再占用输入框上方 widget 区）；回合结束 usage 行改为 claude-mods statusline 配色
（`Tokens: 总量(in/out/cache) | Cache Hit N% | TPS | Elapsed | Cost`，总量蓝、
命中率按阈值绿/琥珀/红、成本红，其余灰）；get_state 补 `piTodos` 快照。
第六期（2026-10-17）：**回退三期 Co-Work 面板**。三期的 `task_list` / `set_context`
工具与 `CoworkPanel` 和五期的 `PiTodosPanel` 是两套并行实现，同屏渲染出两个
「Progress」面板（一个在输入框下方、一个在右上角），任务内容还互不相同。按
"只留一个"的决定，整体摘除三期这条线，只保留五期基于 `todo` 工具的右上角面板。

日期：2026-10-16（六期为 2026-10-17 追加）
基线：abcwyc/pi-agent-desktop main（pi-web v0.10.0, `main@6fcd7d4`）

## 文件清单

### 新增文件（无上游冲突，不参与上游合并）

| 文件 | 职责 |
|---|---|
| `lib/suggestion-engine.ts` | 【一期】建议引擎：限定预算的 transcript（5000 字符、双端保留）+ 会话当前模型 + `completeSimple` 低 token 输出（220 max）、JSON 解析与校验（≤3 条、去重、CJK 安全截断） |
| `app/api/agent/[id]/suggestions/route.ts` | 【一期】`POST /api/agent/[id]/suggestions`：复用运行中 wrapper 或只读重建；`req.signal` 断开即 499 |
| `components/SuggestionChips.tsx` | 【一期】Chips UI：`present()/clear()` 命令式句柄；点击 → `chatInputRef.insertIfEmpty()`（填入不发送）；Escape 关闭；入场 CSS 弹簧近似 |
| `lib/ghost-text.ts` | 【二期】ghost text 引擎：历史前缀匹配（大小写不敏感、CJK 安全、caret 必须在末尾、跳过单字符重复）、Tab 采纳计算、Debouncer；11 个单测覆盖 |
| `lib/ghost-text.test.mjs` | 【二期】引擎单测（Node type-strip 模式，与上游 lib 测试同风格） |
| `components/GhostTextOverlay.tsx` | 【二期】`useGhostText` hook + caret 像素测量（mirror 元素法）；200ms debounce；suppressed 时自动隐藏 |
| ~~`lib/cowork-extension.ts`~~ | 【三期】【六期已删除】pi 扩展：`task_list` / `set_context` 两个模型工具 |
| ~~`app/api/agent/[id]/cowork/route.ts`~~ | 【三期】【六期已删除】`GET`：只读侧栏数据 |
| ~~`components/CoworkPanel.tsx`~~ | 【三期】【六期已删除】Co-Work 面板；与五期 `PiTodosPanel` 重复，整体移除 |
| `components/cds-overlay.css` | CDS token 子集（浅色/暗色 `html.dark`）+ chips、ghost text、cowork panel 样式；刻意不带 open-claude-ui 全局的字体补偿规则。【五期】+`.usage-footer-*` 配色（浅色 / `html.dark`、dark、pine 三套暗色覆盖） |
| `lib/pi-todos.ts` | 【五期】`piTodosFromEvent`（从 `todo` 工具的 tool_execution_end 提取状态）、`reconstructPiTodos`（按当前分支回放 tool result + `/todos` 手工 custom entry） |
| `lib/pi-todos.test.mjs` | 【五期】pi-todos 解析/回放单测 |
| `components/PiTodosPanel.tsx` | 【五期】右上角浮动任务面板：完成计数、可折叠、全部完成后自动收起 |
| `lib/usage-footer.ts` | 【五期】usage 行纯格式化：K/M 紧凑数字、耗时（s / m s / h m）、cache hit 阈值（≥80 good、≥50 fair、其余 poor）、亚分级成本保留非零位 |
| `lib/usage-footer.test.mjs` | 【五期】6 个单测（含截图那一行的完整复现） |
| `components/UsageFooter.tsx` | 【五期】按段渲染 usage 行，颜色全部走 CSS class，不写死 inline 色值 |

### 上游（fork 拥有文件的）受控修改

| 文件 | 改动 |
|---|---|
| `components/ChatWindow.tsx` | 【一期】① import SuggestionChips；② `sessionBusy` 之后加 busy→idle 侦测 effect（600ms 延迟 fetch，AbortController，挂载就绪的 idle 会话不触发）；③ `{chatInputElement}` 之上挂载 `<SuggestionChips />`。【六期】已移除三期的 CoworkPanel import 与挂载 |
| `app/layout.tsx` | 【一期】+2 行 import `@/components/cds-overlay.css`（组件级 CSS import 会破坏上游 Node test runner） |
| `components/ChatInput.tsx` | 【二期】5 处块状接线：① import；② refs 区实例化 `useGhostText`（suppressed = streaming/IME/任一菜单开）；③ `clearInput` 加 hide；④ textarea onChange/onSelect/composition 事件加 update/hide；⑤ handleKeyDown 在所有菜单之后加 Tab-accept 分支 + textarea 后渲染 ghost 层。全部为块状新增，不改写上游行 |
| `components/ModelSelector.tsx` | 【三期】① toolbar 变体 maxWidth 220 → max-content（长模型名完整显示）；② 下拉面板加两级递进：多供应商时先显示供应商行（带模型数+当前选中提示+chevron），点入后显示该供应商模型列表+返回条；单供应商或过滤时保持平铺 |
| `lib/rpc-manager.ts` | 【三期】+1 行 import + 扩展工厂列表中注册 `createCoworkExtension(...)`；【六期】两处均已移除 |
| `components/MessageView.tsx` | 【四期】① 流式 t/s 徽章：亮底（蓝/绿/黄）改深色墨色（#16181d），红底保留白字并加深（#d81a4f），字重 500；② `formatUsage` 增加 `durationMs` 参数：输出 cache hit %（cacheRead/(input+cacheRead+cacheWrite)）与平均 t/s（output/duration），行内 `in/out/cache R/cache W` 格式不变 |
| `components/ContextUsageRing.tsx` | 【四期】环旁常显 `pct% / window`（如 `11% / 2.0M`）：≥10% 取整、<10% 一位小数；≥90% 红色；hover tooltip 与点击开 stats 面板行为不变；按钮加水平 padding 容纳文本 |
| `lib/types.ts` | 【四期】`AssistantMessage` +`durationMs?: number`（pi-ai 原生字段经 normalize 透传，供 usage 行计算平均 t/s） |
| `components/SessionStatsPanel.tsx` | 【四期】统计面板加 Cache hit、Elapsed 两行（纯新增数组项；未套五期配色） |
| `lib/rpc-manager.ts` | 【五期】+1 行 import；`emit(event)` 后若为 todo 工具结果则追加 `pi_todos_update` 事件；`get_state` 返回 `piTodos`（`sessionManager?.getBranch?.()` 可选链，兼容测试桩） |
| `hooks/useAgentSession.ts` | 【五期】`AgentStateResponse.piTodos` 可选字段 + `piTodos` state（切换会话时重置，get_state / `pi_todos_update` 两路更新）并随 hook 返回 |
| `components/ChatWindow.tsx` | 【五期】`aboveEditorWidgets` 过滤掉 `pi-todos` widget（避免重复显示），并在 ExtensionCustomPanel 之后挂载 `<PiTodosPanel />` |
| `components/MessageView.tsx` | 【五期】usage 行改用 `<UsageFooter />`（仅非流式时显示）；旧 `formatUsage` 保留并加 eslint-disable 注释，减少与上游的行级冲突 |

## 与上游同步的兼容性（fork-ownership 机制核对）

- `components/ChatWindow.tsx`、`app/layout.tsx`、`components/ChatInput.tsx` 均已在
  `scripts/fork-ownership.json` 的 `driftedUpstreamFiles` 中（accepted），本 fork 的同步
  工作流对高/中风险文件本来就强制开 review PR，不会无人值守直推 main。
- 四期改动的 `components/MessageView.tsx`、`components/ContextUsageRing.tsx`、
  `lib/types.ts` 同样已在 `driftedUpstreamFiles`（MessageView/ChatInput）或改动极小
  （ContextUsageRing 环旁加一段 inline label；types 加一个可选字段），均为块状/可选
  新增，同步冲突面小。
- 本次改动全部为“块状新增”（import 块、独立 effect、JSX 挂载点、独立 key 分支），没有
  改写上游原有行，textually 干净，冲突时容易三方合并。
- 新增文件路径不在上游 pi-web 中，合并时永远 fast-pass，建议在下次 sync 后把它们登记进
  `forkOwnedPaths`：`components/SuggestionChips.tsx`、`components/GhostTextOverlay.tsx`、
  `components/cds-overlay.css`、`lib/suggestion-engine.ts`、
  `lib/ghost-text.ts`、`lib/ghost-text.test.mjs`、
  `app/api/agent/[id]/suggestions/`；五期再加
  `lib/pi-todos.ts`、`lib/pi-todos.test.mjs`、`components/PiTodosPanel.tsx`、
  `lib/usage-footer.ts`、`lib/usage-footer.test.mjs`、`components/UsageFooter.tsx`。
- 五期新增上游接触点 `hooks/useAgentSession.ts`、`components/SessionStatsPanel.tsx`
  也是块状新增（可选字段、独立 state、独立 effect 分支、数组项），无上游行改写。
- `components/fork-extractions.test.mjs` 的 forbiddenMarkers 检查（禁止 ChatWindow 引入
  apple-touch-icon / PRODUCT_NAME）已被此改动通过。

## 成本与触发

- 每个回合结束**一次**调用，输入预算 6000 字符级、输出 ≤220 token，调用会话自身模型。
- 挂载即 idle 的旧会话不发请求；用户 typed 或新 prompt（`sessionBusy`）立即丢弃。
- 建议填入 composer 但不自动发送（比 ChatGPT 保守，适合编码工具）。

## 验证记录（2026-10-16，本机）

- `npx tsc --noEmit` → 通过
- `npm run lint` → 0 errors（新增文件 0 warning；ChatWindow 的 exhaustive-deps 由 disable 注释解释）
- `npm test` → 2844 pass / 0 fail（含受影响的 render-cache 与 fork-extractions 测试）
- `npm run build`（Next.js standalone）→ 成功，建议路由已打包进 `.next`
- `npm run desktop:build`（Tauri）→ 成功；⚠️ 本机构建注意：Homebrew 的 Node 是动态链接（依赖
  Cellar 内 `libnode.147.dylib`），prepare 脚本只复制 `process.execPath`，打包后内嵌 Node
  无法启动。须用 nodejs.org 官方静态构建的 Node 22 放在 PATH 最前面再跑 desktop:build。
- 安装验证：`/Applications/Pi Agent.app` 启动正常，服务器监听 127.0.0.1 随机端口；
  `POST /api/agent/<bad-id>/suggestions` 返回 404（路由存在、鉴权路径一致）；
  chips CSS 已随 `b7be3d67….css` 打包加载。
- 【五期】全量 `npm test` → 2858 条中 15 条失败，全部为 get_state 新增行调用
  `sessionManager.getBranch()` 时测试桩没有该方法导致（我引入的回归）；改成可选链后，
  `lib/rpc-manager*.test.mjs` 共 135 条全部通过，pi-todos 3 条、usage-footer 6 条通过；
  `npx tsc --noEmit` 通过；改动文件 eslint 0 问题。修复后**未再跑一遍全量**。
- 【五期】GUI 未人工验证（右上角面板位置、与 NoticeShelf toast 是否重叠、移动端布局）。
- 【六期】`npx tsc --noEmit` 通过；`npm run lint` 0 error（2 个 warning 属未触碰的上游文件）；
  `npm test` → 2864 pass / 0 fail。
- 【六期】构建坑（本机，已确认与本次改动无关：把改动 stash 后同样复现）：
  1. 环境里若残留 `__NEXT_PRIVATE_STANDALONE_CONFIG`（运行中的 Pi Agent 会注入），
     `next build` 会跳过默认值补全，报 `TypeError: generate is not a function`。
     构建前须 `env -u __NEXT_PRIVATE_STANDALONE_CONFIG -u __NEXT_PRIVATE_ORIGIN -u PI_WEB_PARENT_PID`。
  2. `cargo` 不在 PATH，需加 `$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin`。
  3. `bundle_dmg.sh` 因残留已挂载的模拟器卷失败；`.app` bundle 本身构建成功，不影响安装。
- 【六期】构建产物核对：`.next-desktop` 中 `cowork` 路由与 `task_list`/`set_context`
  已消失（app-paths-manifest / routes-manifest 均无残留），`PiTodosPanel` 保留。
- 【六期】安装与运行时验证（2026-10-17 06:31，用一次性安装脚本完成）：
  App 退出后自动完成替换并重启；当前会话本身就运行在新包中（`pi-agent-desktop`
  PID 20268，启动于 06:31:27），即最直接的生效证据。
  - `GET /api/agent/<id>/cowork` → **404**（三期路由已消失）
  - `GET /api/agent/<id>/suggestions` → 405（一期路由仍有效，方法不允许）
  - 首页 200；主 chunk `page-db660c5019a16c25.js` 含 `pi-todos-panel`，
    不含 `task_list` / `set_context`
  - 旧包备份：`/Applications/.Pi Agent.app.bak-20261017`（289M，含 2 个 task_list 文件）
- 【六期】踩坑：`launchctl submit` 提交的 job 在脚本退出后被 launchd 自动重启，
  会陷入「等退出→重装」无限循环，并可能用同一备份路径覆盖掉上一份备份。
  一次性安装任务必须在脚本末尾 `launchctl remove <label>` 自我清理，或改用
  `nohup` + 脱离进程组。

## 复用方式

1. `overlay/` 下的新文件按相对路径拷入目标 checkout；
2. 应用 `upstream-file-patches.diff`（全部受控修改的上游文件，`git diff` 生成）；
3. 下次上游 sync 后，把上面列出的新路径登记进 `scripts/fork-ownership.json` 的 `forkOwnedPaths`。

## 后续（候选）

- Suggestions / ghost text 的 Settings 开关
- CoworkPanel 记忆区接 OpenViking API 做会话级记忆读写（当前仅外链）
- SessionStatsPanel 的 Cost / Cache hit 行套用 `.usage-footer-*` 同一套阈值配色
