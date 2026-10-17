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
第七期（2026-10-17）：**修复一期 follow-up 建议从未生效**（严重，功能自交付起就是坏的）。
症状：对话结束后不出现建议 chips。根因：`lib/suggestion-engine.ts` 用
`completeSimple()`（来自 `@earendil-works/pi-ai/compat`）发起请求，而 compat 的凭据解析
只查一张写死的 provider→环境变量表（`getEnvApiKey`），其中**没有 `magpie` 这类自定义
本地网关**，因此每次调用都抛 `No API key for provider: magpie`。同一会话下
`/api/sessions/<id>/auto-name`（走 `agent.streamFunction`，携带 models.json 已解析的
鉴权）返回 200，而 `/api/agent/<id>/suggestions` 返回 500，即为铁证。修复：改用
会话自身的 `source.streamFunction(...)`，与 `lib/session-title.ts` 一直以来的做法一致。

第八期（2026-10-17）：**修复 ghost text 的两个已知缺陷，并把 overlay 用
beautifului.dev（MIT，© 2026 Shane Levine）的元素重新设计，保留 Claude/CDS 的视觉要素。**

修复部分（第七期遗留的「后续（候选）」第 1 项）：
- **定位**：原实现在 `.ghost-text-layer`（`position: absolute`，最近的定位祖先是外层
  `.chat-composer-wrap`）里用隐藏 mirror 元素测光标，位置基准与预期不符，且测量一旦
  失败就静默不显示。现改为**不做任何光标测量**——补全提示作为 textarea 的普通 flex
  兄弟节点渲染，位置不可能错。
- **只触发一次**：原实现只在 textarea 的 change/select 里重算，其他改动 draft 的路径
  不会重算，表现为「只有第一次生效」。现改为**以 draft 值本身为依赖**重算，且 state
  更新做同一性检查（completion/source 相同则不 setState），因此重算不会成环。

重设计部分（新增 `components/bui-overlay.css`，命名空间 `--bui-*`）：
- **token 层**：oklch 四/五层表面、三级 ink、6/8/10/14 圆角梯度、发丝环 + 分层阴影、
  五档缓动、4 个动效原语（shimmer-text / pop-in / fade-up / progress rail sweep）。
- **SuggestionChips → 推荐卡**（借 beautifului `RecommendationCard` 结构）：卡片外壳 +
  标题行 + 序号 + 悬停出现的 ↵ 采纳提示 + 逐行 fade-up。**刻意不做置信度仪表**——引擎只
  返回纯文本，不凭空造分数；保留 Claude 的「只填入、不发送」保守交互与 Clay 强调色。
- **PiTodosPanel → TaskRows**：完成度进度条（忙碌时带扫光）、逐行状态徽标（✓ / 空心，
  只有 done / 未完成两态，不假装有 per-task 运行态）、长行可就地展开、`+N more` 折叠、
  忙碌时头部 `Working · Ns` shimmer 计时（对应 beautifului `LoadingState`）。
  「Progress」/「Memory」分区命名与 OpenViking 入口保留。
- **ghost text 提示**：`Tab` 键帽 + 补全预览，走同一套 control 圆角与发丝环。

第九期（2026-10-17）：**修掉「发完消息后最后一条被推出视口、窗口剩下空白」，并给 pi-todos 面板加上缩放、折叠与关闭。**

问题 1：发完消息后，自己刚发的内容被推出视口，可见区域只剩空白。
- 写入锚点（prompt anchor）按 `container.clientHeight` 计算预留高度，而 composer 是
  **绝对定位覆盖在滚动容器之上**的，底部 `composerHeight` 像素永远看不见。预留高度因此
  多了整整一个 composer 的高度，任何“滚到底”（流式跟随、composer spacer 同步）都会滚到
  锚点下方 `composerHeight` 处，把问题推出视口、只留下两块留白 spacer。
- 修法：锚点按**可见高度**（`clientHeight - composerHeight`）计算，并观察 composer，
  使其自身高度变化时重新测量。

问题 2：回合结束时建议卡在 composer 流内，composer 高度从 141px 涨到 292px，
composer spacer 同步把聊天滚到底——刚发的问题直接被顶出视口（实测 `topInViewport = -15`）。
- 修法：建议卡改为绝对定位悬在 composer 上方（与上游 scroll-to-bottom 按钮同一做法），
  composer 高度不再随卡片变化。实测回合结束后 spacer 保持 141px，问题仍在视口内（`+136`）。

问题 3：pi-todos 面板会盖住刚发的问题，且无法缩放/关闭。
- 新增三种状态：**card / pill / closed**，宽度可拖左边缘调整（也支持聚焦后用 ←/→），
  `localStorage` 记住模式与宽度。
- **不遮挡**：只有卡片宽度放得进消息列旁的空档
  （`gutter = (chatWidth - 820) / 2 >= width + 12`）时才用卡片，否则退化为小胶囊；
  锚点生效（问题钉在顶部）或回合进行中时同样退化为胶囊，并整体下移到 `top: 76px`。
  实测：1900px 窗口卡片距消息列 94px、1500/1280px 退化胶囊无重叠；1100px 窗口胶囊
  与列右缘重叠 74px（窄窗口下浮层无法完全避免，胶囊仅 82x27 且可关闭）。
- 顺手修了一个自己的真 bug：测量聊天区宽度的 effect 依赖为 `[]`，而面板在无 todo 时
  不渲染，导致首次 mount 拿到 null ref 后再也不测量，永远停留在卡片布局。改为按
  `hasRows` 触发；`setPointerCapture` 也改成不致命（浏览器可拒绝）。

第九期补充（同日，Lex 反馈「任务面板结束后点击打不开」）：
- 现象：在 1666px 窗口（聊天区 1406px、空档 293px）点胶囊毫无反应。实测确认点击已
  生效并写入了 `{"mode":"card"}`，但渲染仍是胶囊——因为当时要求“卡片宽度必须放得下”
  才展开，300 > 293 于是静默拒绝。
- 修法：**显式点击一律打开**，宽度改为**收窄到空档**而不是拒绝；只有自动弹出保持保守
  （放得下且问题未被钉顶时才用卡片）。空档计算同时补上了面板自身的 `right: 16px`
  内缩（之前少算一层，收窄后会与消息列齐平 0 间隙）。
- 另：关闭后再点恢复片，会回到关闭前的状态（记住上一次 card / pill），不再固定退回胶囊。
- 实测（dev 实例）：1666 窗口 → 卡片 261px、距消息列 **16px**、不重叠（修前：点击无效）；
  1900 窗口 → 卡片 320px、间隙 74px；1400/1200 窗口 → 显式打开时降到 220px 下限，
  自动弹出仍为胶囊。完整循环「卡片 → 折叠 → 点击胶囊 → 卡片 → 关闭 → 恢复 → 卡片」通过。

验证（2026-10-17，dev 实例 127.0.0.1:30155 + Chrome DevTools 实测，非只看代码）：
- 发送后：回合进行中 `msgTopInViewport = 22`（完整可见）；回合结束后 `+136`
  （修复前同场景为 `-15`，已出视口）。
- 面板：1900/1500/1280/1100 四档宽度下的 card↔pill 判定与几何均实测；折叠→胶囊、
  再次点击→卡片、关闭→恢复胶囊（◱ 2/4）、恢复→胶囊四种交互与 localStorage
  持久化均通过；拖拽与键盘缩放改变宽度并落盘。
- `npx tsc --noEmit` 通过；`npx eslint`（改动文件）exit 0；`npm test` → **2864 pass / 0 fail**；
  `npm run check:branding` 2 pass。
- 上游测试 `hooks/useAgentSession.test.mjs` 里断言锚点第三参为 `container.clientHeight`
  的那一条已按新语义更新（改为断言可见高度与 composer 观察），属必要修改。

第十期（2026-10-17）：**运行中也能切换模型；上下文环旁显示整个会话的费用与平均 t/s。**

运行中切换模型：
- 先实测服务端是否允许。在会话 `isStreaming=true`、`isPromptRunning=true`（正在跑 bash sleep）
  的时刻 POST `set_model` → **HTTP 200** `{"success":true,...}`，会话文件按顺序写入新的
  `model_change`；同一轮回复正常结束，无报错。也就是说**服务端本来就接受运行中切换**
  （`SESSION_REPLACEMENT_COMMAND_TYPES` 只有 fork/clone），被拦住的只是 UI。
- 于是把 `ChatInput` 里 `ModelSelector` 的 `disabled={isStreaming}` 去掉，新增 `streaming`
  prop：运行中提示语变为 `Change model · applies from the next message`（在途请求保留原模型，
  新模型从下一条消息生效）。
- UI 端到端验证：`sessionBusy=true` 时模型按钮 `disabled=false`、菜单可展开（52 个选项），
  点选后 `get_state` 与会话文件都变为所选模型，测试会话随后已还原。

会话费用 + 平均 t/s（上下文环右侧）：
- 数据侧：`lib/session-stats.ts` 新增 `generationMs`（累加 assistant 消息的 `durationMs`），
  `emptyStats` / `addMessage` / `mergeSessionStats`（按 delta，与 token/cost 同规则）同步；
  `SessionStatsInfo` 暴露该字段。分母只取**生成耗时**，不含工具执行与等待，才叫平均吞吐。
- 展示侧：`ContextUsageRing` 在 `48% / 1.0M` 之后追加 `$0.8827 · 59.0 t/s`，样式在
  bui-overlay.css（`.ctx-session-metrics`，沿用 usage footer 的配色），hover 提示
  `Session cost $0.8827 · Average 59.0 t/s over 1h14m of generation`。数值取自整个会话文件，
  不是当前加载的那一页。
- 实测（本机真实会话）：环旁文本为 `48% / 1.0M | $0.8827 | 59.0 t/s`。

测试：新增 2 条（`generationMs` 聚合、merge 的 delta 语义），另有 2 条上游的 stats 形状
断言（`returns zeros for an empty session`、`session stats cover the full file...`）按新字段
更新。`npx tsc --noEmit` 通过；`npm test` → **2866 pass / 0 fail**。

第十一期（2026-10-17）：**回合结束后，工具调用收敛成 footer 里的一行摘要，点击展开还原。**

- 来源：Lex 指出一屏里成片的绿色工具行（`bash …` 24s）太占地方，问能不能在回合结束后
  收成 footer 里的一句 summary、点开再还原。
- 实现（`components/MessageView.tsx`，块状新增）：`AssistantMessageView` 里统计本回合的
  toolCall 块，`!isStreaming` 且数量 ≥2 时不渲染这些块，改为在 `.message-assistant-footer`
  里渲染一行 `⚙ 2 tool calls · bash ×2  44s  ⌄`（沿用 beautifului `ToolChips` 的思路）；
  点击切回逐行原样，与既有 usage footer 并排，视觉上是一行仪表。
- 阈值取 **2**：单个工具调用本身就是一行摘要，折起来只是多一次点击；同时这让 4 条既有
  上游渲染测试（subagent 工具行、apply_patch 报错、tool-result 图片、codemode 折叠）
  无需改动即可继续覆盖“展开态”的渲染。
- 细节：命中搜索的 toolCall 不会被折叠（否则搜索结果会消失）；初始化尊重既有的
  `isToolCallExpanded(toolCallId)` 持久化偏好，用户此前展开过的回合不会被强行折起；
  流式进行中不折叠，进度照旧可见。
- 实测（dev 实例真实会话）：折叠态该消息块高 **102px**、展开态 **183px**（+81px 即两行
  工具行），摘要文本 `⚙ 2 tool calls · bash ×2 44s ⌄`，`aria-expanded` 随点击翻转。
- `npx tsc --noEmit` 通过；`npx eslint` 0；`npm test` → **2866 pass / 0 fail**。

第十二期（2026-10-17）：**排队消息支持逐条移回输入框（原来只有一个「全部移回」）。**

- 来源：Lex 指出「移回输入框」应该是**对应每一条可选**的，而不是整队一起。
- 现状核对：队列头部的按钮调的是 `clear_queue`，即整队清空并全部塞回输入框；`chat.recallTitle`
  的原文本身就是「移除**所有**排队消息」。所以缺的是单条能力。
- 约束（必须说明）：pi SDK **没有单条出队 API**。`AgentSession` 只有 `steer` / `followUp` /
  `clearQueue`（整清）与只读 getter；真正的投递队列在 `pi-agent-core` 的
  `PendingMessageQueue`（`private`，只有 `clear()`/`drain()`）。上游 `clear_queue` 的注释也明说
  「clear+requeue 会和 agent loop 取消息竞争」。
- 实现（`lib/rpc-manager.ts` 新增 `recall_queued`）：先校验索引（越界直接报错、**不动队列**），
  再 `clearQueue()`，从返回的两个数组里 splice 出目标那条并**不重新入队**，其余按原顺序与
  原类型用 `steer`/`followUp` 放回。**结果语义是正确的**：被召回的那条不会再投递，其余不会
  丢失也不会重复；唯一暴露面是时序——若 agent 的取消息时机恰好落在 clear 与回填之间，其余
  消息会晚一个取用周期投递。
- 客户端：`hooks/useAgentSession.ts` 新增 `handleRecallQueuedItem(kind, index)`（复用
  `prependText` 把内容放回输入框，并用返回值同步本地队列，因为 `queue_update` 只在 SSE 在线时
  到达）；`ChatInput` 的 `QueuedMessageRow` 每行加一个 `↵ 移回输入框` 按钮（hover 才显示，
  样式在 bui-overlay.css）；头部按钮文案由「移回输入框」改为**「全部移回」**以区分（i18n 新增
  `chat.recallThis` / `chat.recallThisTitle`，三个语言包同步）。
- 实测（dev 实例 + 真实队列）：
  - 队列 `{steering:[STEER-A], followUp:[FOLLOWUP-B]}` → `recall_queued(followUp, 0)` 返回
    `{recalled:"FOLLOWUP-B", steering:["STEER-A"], followUp:[]}`，之后 `get_state` 一致。
  - 队列 `{steering:[STEER-A, STEER-C], followUp:[FOLLOWUP-D]}` → 召回 `steer[1]` 只移除
    STEER-C，保留 STEER-A 与 FOLLOWUP-D。
  - 越界索引 → `Queued message not found`，队列原样不动。
  - UI 端到端：两个排队行各带自己的按钮，点 FOLLOWUP-TWO 那行 → 输入框填入
    `FOLLOWUP-TWO`，队列只剩 STEER-ONE。
- `npx tsc --noEmit` 通过；`npm test` → **2866 pass / 0 fail**。

第十三期（2026-10-17）：**⌘+ / ⌘- / ⌘0 缩放对话区与左侧导航栏。**

- 来源：Lex 要求上下文窗口和左侧导航栏支持 ⌘加号/减号缩放。
- 实现（新增 `components/ZoomShortcuts.tsx`，在 `app/layout.tsx` 挂载，渲染 null）：
  - 对话区走**既有**的聊天字号设置（`useChatAppearance` → `--chat-content-font-size`，即
    Settings → Chat 的「内容字号」滑杆，12–24px），步进 1px —— 快捷键和滑杆写同一个 store
    与同一个 localStorage key，所以两边永远一致。
  - 侧栏走新增的 `--sidebar-scale`（0.9–1.3，步进 0.05，key `pi-sidebar-scale`）：
    `bui-overlay.css` 在 `.app-sidebar` 作用域内重新声明 `--fs-micro/caption/small/body/title`，
    只缩放侧栏文字，顶栏与面板保持原尺寸。
  - 侧栏有两个元素带 **inline** px 字号（项目标题 `.sidebar-header-row > span` 13px、时间
    `.session-item-time` 11px），token 覆盖不到，已用两条 `!important` 规则单独缩放。
  - ⌘0 复位两者；⌘= 与 ⌘+ 都接受；按住 ⌥ 不触发；IME 合成中不触发；绑定在捕获阶段并
    preventDefault，避免 WebView 自行滚动/缩放。
- 过程中修掉自己一个真 bug：`clampSidebarScale` 用 `Number(value)`，而 `Number(null)` 是 0
  且 `Number.isFinite(0)` 为真，导致**未设置偏好时会被夹到最小值 0.9**（首测即暴露
  `--sidebar-scale=0.9`）。已改为先排除 null/空串/非正数。
- 实测（dev 实例，真实界面）：
  | 操作 | --chat-content-font-size | --sidebar-scale | 输入框 | 会话标题 | 时间戳 |
  |---|---|---|---|---|---|
  | 起始 | 15px | 1.05 | 15 | 13.7 | 11.6 |
  | ⌘= ×2 | 17px | 1.15 | 17 | 15 | 12.7 |
  | ⌘- ×4 | 13px | 0.95 | 13 | 12.4 | 10.5 |
  | ⌘0 | 14px | 1 | 14 | 13 | 11 |
  两者都写入 localStorage（`pi-chat-content-font-size` / `pi-sidebar-scale`）。侧栏 token
  作用域评测：51 个文本节点中 31 个随缩放变化，余下的是 inline 字号元素，已由上面两条规则补齐。
- `npx tsc --noEmit` 通过；`npm test` → 2866 pass / 0 fail。

第十四期（2026-10-17）：**我发的那条提问一直置顶可见（当前正在回应什么，一眼就能看到）。**

- 来源：Lex 要求「每次对话的上下文窗口里，我发送的最近一次内容一直置顶显示，方便分辨当前在回应什么」。
- 为什么不直接延长既有的 prompt anchor：anchor 只在**回合进行中**把消息滚到顶部，回合结束就释放，
  而尾随滚动会把回复带进视野——提问恰好在你开始读答案时离开屏幕。两者目标不同：
  anchor 管「生成时占位」，本需求要的是「读答案时仍有参照」。
- 实现（新增 `components/PinnedPromptBar.tsx`，在 ChatWindow 的消息滚动容器内作为第一个子元素，
  `position: sticky; top: 0`，不放布局成本；**不改动任何滚动逻辑**）：
  - 内容取「渲染列表里最后一条 user 消息」的文本（含多模态的 text 块拼接），并带它的
    `data-entry-id`。
  - **真正的消息完整可见时自动隐藏**（IntersectionObserver，root 为滚动容器，阈值 0.98）——
    同一段文字永不重复出现，滚动时也不会跳变；滚出视野就顶上。
  - 点击整条展开/收起（超长提问展开后最高 26vh 可滚动），右侧 ↑ 按钮跳回该条消息
    （`[data-entry-id]` + 现有 `scrollToMessage`）。
  - 新增 i18n：`chat.pinnedPrompt` / `chat.pinnedPromptToggle` / `chat.pinnedPromptJump`（三语言）。
- 实测（dev 实例，真实会话）：
  - 停在底部时：bar 存在、`position: sticky`、文本为最后一条提问。
  - 点击 → `is-expanded` 生效；点击 ↑ → `scrollTop` 2644 → 2096，提问进入视野后 **bar 自动消失**。
  - 再滚回底部 → bar 重新出现。
- `npx tsc --noEmit` 通过；`npm test` → **2866 pass / 0 fail**。

第十五期（2026-10-17）：**Settings → Chat 新增「回复语言」：跟随模型 / 强制中文 / 强制英文。**

- 来源：Lex 问能不能有个菜单选择是否强制中文输出、还是按模型自定义。
- 为什么不把指令塞进用户消息：那样会出现在对话记录里，且模型很容易忽略。指令必须落在
  **系统提示词**里才压得住模型自身习惯与 AGENTS.md。
- 机制：`before_agent_start` 钩子是唯一还能改提示词的时机——它收到已经渲染好的提示词，
  返回的 `systemPrompt` 会替换本次运行的提示词。新增 `lib/output-language-extension.ts`
  在收到的文本**后面追加**一段指令，因此工具、上下文文件、项目规则等其它段落原样保留
  （与 `lib/exact-system-prompt.ts` 同一机制）。
- 生效方式（关键）：语言值**随每条 prompt 命令上传**（`outputLanguage` 字段），服务端把它
  存在会话包装器上，钩子每次运行读取——所以改设置**对已打开的会话从下一条消息就生效**，
  不需要重开会话，也不需要服务端再存一份配置；数值持久化在浏览器 localStorage。
- UI：Settings → Chat 里用与「diff 视图」同款的单选按钮组（跟随模型 / 强制中文 / 强制英文），
  三语言 i18n 同步。
- 实测（真实会话，非只看代码）：
  - 在钩子里临时打点，服务端日志显示 `appending directive language=zh-CN basePromptChars=28466`
    ——带 `outputLanguage` 的那条触发且保留了 28466 字符的原始提示词；**不带（auto）的那条没有打点**，
    说明只有强制模式才改动提示词。
  - 行为验证：全局 `~/.pi/agent/AGENTS.md` 要求中文的前提下，强制 `en` 后模型用英文回答了
    「用一句话说明电阻是什么」（"A resistor is a passive component that limits the flow of
    electric current…"），说明指令确实生效且优先级高于 AGENTS.md；打点也记录 `language=en`。
  - 打点已移除。
- 新增 `lib/output-language.test.mjs`（6 条）：归一化（未设置/未知值→auto，不猜语言）、
  只有强制模式产生指令、追加时保留原提示词头部、auto 不动提示词、**切换语言在下一次运行生效**、
  已带标记时不重复追加。
- 顺带：`lib/rpc-manager.ts` 里 overlay 扩展故意排在 SDK 内建扩展**之后**，这样上游那条断言
  内建扩展顺序的测试无需改动；`components/SettingsPanel.test.mjs` 的聊天选项计数按实际从 6 改为 7。
- `npx tsc --noEmit` 通过；`npm test` → **2872 pass / 0 fail**（2866 + 新增 6）。

日期：2026-10-16（六期、七期为 2026-10-17 追加，八、九期为 2026-10-17 追加）
基线：abcwyc/pi-agent-desktop **v0.7.1**（tag `v0.7.1` = `9519ce4c1c2e504ba1d0aaaddcfed6ea8e49d0b3`；上游 pi-web v0.10.0 合并至
`6fcd7d4`，该 SHA 是 pi-web 的提交，不是 pi-agent-desktop 的）

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
| `components/cds-overlay.css` | CDS token 子集（浅色/暗色 `html.dark`）+ chips、ghost text、cowork panel 样式；刻意不带 open-claude-ui 全局的字体补偿规则。【五期】+`.usage-footer-*` 配色（浅色 / `html.dark`、dark、pine 三套暗色覆盖）。【八期】ghost text 的旧 inline 层样式（`.ghost-text` / `.ghost-text-layer`）已删除，改由 bui-overlay.css 承载提示样式 |
| `components/bui-overlay.css` | 【八期】beautifului.dev 元素层：`--bui-*` token（oklch 表面/ink/线/语义色、6-8-10-14 圆角、发丝环分层阴影、五档缓动）、4 个动效原语、SuggestionChips 卡片、TaskRows 任务面板、ghost text 提示。放在 cds-overlay.css 之后加载 |
| `lib/pi-todos.ts` | 【五期】`piTodosFromEvent`（从 `todo` 工具的 tool_execution_end 提取状态）、`reconstructPiTodos`（按当前分支回放 tool result + `/todos` 手工 custom entry） |
| `lib/pi-todos.test.mjs` | 【五期】pi-todos 解析/回放单测 |
| `components/PiTodosPanel.tsx` | 【五期】右上角浮动任务面板：完成计数、可折叠、全部完成后自动收起。【八期】改为 beautifului TaskRows 结构（进度条 + 状态徽标 + 长行展开 + `Working · Ns`）。【九期】card / pill / closed 三态、左边缘拖拽缩放（←/→ 亦可）、`localStorage` 记忆，且仅在卡片放得进消息列旁空档时展开 |
| `lib/usage-footer.ts` | 【五期】usage 行纯格式化：K/M 紧凑数字、耗时（s / m s / h m）、cache hit 阈值（≥80 good、≥50 fair、其余 poor）、亚分级成本保留非零位 |
| `lib/usage-footer.test.mjs` | 【五期】6 个单测（含截图那一行的完整复现） |
| `components/UsageFooter.tsx` | 【五期】按段渲染 usage 行，颜色全部走 CSS class，不写死 inline 色值 |

### 上游（fork 拥有文件的）受控修改

| 文件 | 改动 |
|---|---|
| `components/ChatWindow.tsx` | 【一期】① import SuggestionChips；② `sessionBusy` 之后加 busy→idle 侦测 effect（600ms 延迟 fetch，AbortController，挂载就绪的 idle 会话不触发）；③ `{chatInputElement}` 之上挂载 `<SuggestionChips />`。【六期】已移除三期的 CoworkPanel import 与挂载 |
| `app/layout.tsx` | 【一期】+2 行 import `@/components/cds-overlay.css`（组件级 CSS import 会破坏上游 Node test runner） |
| `components/ChatInput.tsx` | 【二期】5 处块状接线：① import；② refs 区实例化 `useGhostText`（suppressed = streaming/IME/任一菜单开）；③ `clearInput` 加 hide；④ textarea onChange/onSelect/composition 事件加 update/hide；⑤ handleKeyDown 在所有菜单之后加 Tab-accept 分支 + textarea 后渲染 ghost 层。全部为块状新增，不改写上游行。【八期】`useGhostText` 增加第 4 个参数 `value`（重算依赖）；textarea 之后渲染的 ghost 层由「绝对定位 span + 光标坐标」改为「普通 flex 兄弟节点提示（`Tab` 键帽 + 补全预览）」，不再需要光标测量 |
| `components/ModelSelector.tsx` | 【三期】① toolbar 变体 maxWidth 220 → max-content（长模型名完整显示）；② 下拉面板加两级递进：多供应商时先显示供应商行（带模型数+当前选中提示+chevron），点入后显示该供应商模型列表+返回条；单供应商或过滤时保持平铺 |
| `lib/rpc-manager.ts` | 【三期】+1 行 import + 扩展工厂列表中注册 `createCoworkExtension(...)`；【六期】两处均已移除 |
| `components/MessageView.tsx` | 【四期】① 流式 t/s 徽章：亮底（蓝/绿/黄）改深色墨色（#16181d），红底保留白字并加深（#d81a4f），字重 500；② `formatUsage` 增加 `durationMs` 参数：输出 cache hit %（cacheRead/(input+cacheRead+cacheWrite)）与平均 t/s（output/duration），行内 `in/out/cache R/cache W` 格式不变 |
| `components/ContextUsageRing.tsx` | 【四期】环旁常显 `pct% / window`（如 `11% / 2.0M`）：≥10% 取整、<10% 一位小数；≥90% 红色；hover tooltip 与点击开 stats 面板行为不变；按钮加水平 padding 容纳文本 |
| `lib/types.ts` | 【四期】`AssistantMessage` +`durationMs?: number`（pi-ai 原生字段经 normalize 透传，供 usage 行计算平均 t/s） |
| `components/SessionStatsPanel.tsx` | 【四期】统计面板加 Cache hit、Elapsed 两行（纯新增数组项；未套五期配色） |
| `lib/rpc-manager.ts` | 【五期】+1 行 import；`emit(event)` 后若为 todo 工具结果则追加 `pi_todos_update` 事件；`get_state` 返回 `piTodos`（`sessionManager?.getBranch?.()` 可选链，兼容测试桩） |
| `hooks/useAgentSession.ts` | 【五期】`AgentStateResponse.piTodos` 可选字段 + `piTodos` state（切换会话时重置，get_state / `pi_todos_update` 两路更新）并随 hook 返回 |
| `components/ChatWindow.tsx` | 【五期】`aboveEditorWidgets` 过滤掉 `pi-todos` widget（避免重复显示），并在 ExtensionCustomPanel 之后挂载 `<PiTodosPanel />`。【八期】`<PiTodosPanel>` 增加 `busy={sessionBusy}`，仅驱动忙碌时的扫光进度条与 `Working · Ns` 计时。【九期】锚点预留高度改按可见高度（减掉 composer 高度）计算并观察 composer；`<PiTodosPanel>` 再传 `anchored={promptAnchorActive}` |
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
- 【七期】验证记录（2026-10-17）：
  - 修复前：`POST /api/agent/<id>/suggestions` → **500** `No API key for provider: magpie`；
    对照 `POST /api/sessions/<id>/auto-name`（同一会话、同一模型）→ **200**。
  - 修复后（隔离实例 `next start -p 39991` 实测，4 个不同会话）：全部 **200**，
    各返回 3 条与上下文相关的建议，用时 2.5–3.0s。
  - 边界：不存在的会话仍返回 **404**；主服务不受影响。
  - `npx tsc --noEmit` 通过；`npm run lint` 0 error；`npm test` → 2864 pass / 0 fail。
  - 构建产物核对：`suggestions/route.js` 内 `streamFunction` 出现 1 次、
    `completeSimple` 出现 0 次。
- 【七期】ghost text（二期）实测状态：**可用但不稳**。已由第八期重构，见下。
- 【八期】验证记录（2026-10-17）：
  - `npx tsc --noEmit` 通过；`npx eslint`（6 个改动文件）exit 0，无 error / warning；
    `npm test` → **2864 pass / 0 fail**；`npm run check:branding` 2 pass。
  - 构建：`npm run desktop:build`（静态 Node 22 + rust toolchain PATH，
    `env -u __NEXT_PRIVATE_STANDALONE_CONFIG -u __NEXT_PRIVATE_ORIGIN -u PI_WEB_PARENT_PID`）
    → `.app` bundle 生成成功（本次连 DMG 也一起产出；末尾仅 updater 私钥缺失报警，与
    功能无关，沿用既有做法）。
  - 产物核对：`suggestions/route.js` 内 `streamFunction` 1 次、`completeSimple` 0 次；
    `.bui-progress-rail`、`.ghost-text-hint-word`、`.suggestion-card-spark` 均已在打包后的
    CSS / client chunk 中命中。
  - 未做 GUI 人工验证（与五期同一限制）：新卡片、progress rail、
    `Working · Ns` 的实际观感需在重装后的 App 里看一眼。
  - 【八期】发布前从零验证：在 `v0.7.1` 的干净 worktree 上 `git apply
    upstream-file-patches.diff` + 拷入 `overlay/`，`tsc --noEmit` 通过、`npm test` →
    **2864 pass / 0 fail**。同时修正了旧说明里的基线错误：`6fcd7d4` 是 **pi-web** 的提交
    （pi-web v0.10.0），在那个 SHA 上 checkout 得到的是 pi-web，补丁无法应用。

## 复用方式

1. `overlay/` 下的新文件按相对路径拷入目标 checkout；
2. 应用 `upstream-file-patches.diff`（全部受控修改的上游文件，`git diff` 生成）；
3. 下次上游 sync 后，把上面列出的新路径登记进 `scripts/fork-ownership.json` 的 `forkOwnedPaths`。

## 后续（候选）

- Suggestions / ghost text 的 Settings 开关
- SessionStatsPanel 的 Cost / Cache hit 行套用 `.usage-footer-*` 同一套阈值配色
- 若 beautifului 继续引入：下一步可考虑它的 `ToolChips`（工具调用折叠汇总）与
  `StreamingText`（内联来源 + follow-up），两者与 MessageView 的工具块天然对齐；
  `DiffTable` / `RecordsTable` 体量大且场景偏离，暂不移植
