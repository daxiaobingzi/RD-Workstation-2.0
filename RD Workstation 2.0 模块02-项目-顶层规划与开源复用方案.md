# RD Workstation 2.0 · 模块 02「项目」顶层规划与开源复用方案

> 基线：《RD Workstation 2.0 开放式弱电智能化个人工作台实施方案.md》§5.1 / §5.2 / §16 / §39 / §41 / §42 / §50
> 用途：本模块独立规划，确认后实施。个人自用场景，许可不做一票否决（详见总索引文档）。

---

## 一、模块定位

项目是整条业务链的地基与容器：**项目 → 建筑 → 区域/弱电间 → 系统 → 点位/设备/任务/日程/清单/预算/文档/版本/复盘**（§5.1）。

项目页职责 = ①承载空间结构与系统结构；②聚合进度/问题/待办；③作为清单/预算/版本/复盘的阅览入口；④项目级"最近修改"与复盘沉淀。

## 二、现状与差距（评审已有代码）

| 能力 | 现状 | 差距 |
|---|---|---|
| 空间结构 建筑/区域/弱电间 CRUD | 上轮已入 [project.service.ts](file:///e:/02%20AI%20outpt/Trae%20work/RD%20Workstation%202.0/rd-workstation/src/services/project.service.ts)（buildings/areas/telecomRooms 全套），但**管理入口只在点位页内弹窗** | 项目页无"建筑"标签页；删除保护等策略在 service 已有 |
| 系统管理 | 系统增删 + 列表 + 进入设计 ✅ | 基本达标 |
| 概览 | 摘要/系统进度/近期任务/文档数 | 缺：自动进度、设计问题（校核结果）、最近修改 |
| 任务 / 日程 | [ProjectDetailPage](file:///e:/02%20AI%20outpt/Trae%20work/RD%20Workstation%202.0/rd-workstation/src/features/projects/ProjectDetail/ProjectDetailPage.tsx) 中 tasks 展示已实现，schedules tab 为占位 | ①tab 未接 TaskService/ScheduleService 完整列表+新建；②今日/日程联动 |
| 设备 tab | 占位 | 需展示项目选型（DesignService.selections 按 ps）+ 用量聚合 |
| 清单/预算 tab | 版本+对比、预算展示 ✅ | 达标（细节随模块 05 优化） |
| 版本 tab | 仅清单 diff | 扩展到点位/设计快照版本（Revision 表已存在，未启用） |
| 文档 tab | 占位（只统计数量） | Document CRUD（富文本模块 07 再接入） |
| 复盘 tab | 占位 | 复盘表单 → 沉淀 KnowledgeItem（知识模块 07 落地） |
| 数据备份 .rdw | 无 | 导出/导入项目 JSON 包（个人自用，先做轻量版） |

## 三、顶层设计

### 3.1 数据模型（现有 domain 的补充，不新增大表）
- `projects`（已有）→ 增加 `progress_auto` 口径：由 系统进度+任务完成率+清单预算完成 加权自动计算（§5.2 不人工输入）。
- `buildings/areas/telecom_rooms`（已建）→ 项目页树形管理入口正式化。
- `revisions`（已有表，未启用）→ 启用：点位/设计结果变更时写 `snapshot_json + change_summary`，支撑"版本/最近修改"。
- `documents`（已有）→ 启用 CRUD 与"设计问题记录"类型。
- `activity_logs` 可复用于"最近修改"（可选，先读 sn见 revision 简化）。

### 3.2 页面结构（§39 项目工作台，12 tab 收敛为 10 张卡片式）
保留现有 tab：**概览 / 建筑 / 系统 / 点位 / 设备 / 任务 / 日程 / 清单 / 预算 / 文档 / 版本 / 复盘**。
- 概览：摘要 + 自动进度 + 设计问题（调 ValidationEngine / DesignService.check）+ 最近修改 + 近期任务/日程 + 预算汇总
- 建筑：树（项目 ▸ 建筑 ▸ 区域/弱电间）+ 增删改查（复用 service）
- 任务：新增/勾选完成/优先级/截止，支持关联系统（system 维度筛选）
- 日程：按周视图列出 Schedule（组件见开源决策）
- 设备：按系统展示 DeviceSelection（model/品牌/数量/单价/金额）+ 型号用量汇总
- 版本：清单版本 diff（已有）+ 点位快照版本列表
- 文档/复盘：轻量 CRUD；复盘提交沉淀为 Document(review_record)，KnowledgeItem 桥接随模块 07 落地

### 3.3 不与既有已验证功能冲突
不改：领域推导链、设备中心、清单/预算生成链路。项目页只作**编排展示与结构管理**。

## 四、开源复用决策（GitHub 已核实，个人自用场景）

| 能力 | 候选 | 结论 | 可借用子模块 |
|---|---|---|---|
| 表格（设备/点位/版本表） | TanStack Table ≈28-30k **MIT** | **A 直接依赖**（全局统一） | 排序/过滤/行选择/虚拟滚动 |
| 日程周视图 | **FullCalendar ≈19k MIT（标准版）** | **A 已接入** | 月/周/日/列表视图、事件源、拖拽（interaction）、zh-CN locale |
| 日历备选/已弃 | schedule-x ≈2.3k MIT（temporal 实例在 vite 预构建层无法统一，白屏；已卸载换用 FullCalendar） | 淘汰记录 | — |
| 任务看板拖拽 | **@dnd-kit/core ≈17.5k MIT** | **A 已接入** | 跨列拖拽、排序、无障碍、键盘拖拽 |
| 里程碑/时间线 | **frappe-gantt ≈6k MIT** | **A 已接入** | 交互式 Gantt、里程碑样式、依赖连线（样式已本地化） |
| 任务多视图（看板/Gantt） | plane ≈32k **AGPL** 个人自用可部署 | B 借鉴交互与数据模型，不依赖 | Work Items/Cycles/多视图/迭代燃尽 |
| 任务数据多视图参考 | AppFlowy ≈76k **AGPL** | B 借鉴"一表多视图" | 数据库视图模型 |
| 轻量 Kanban/属性 | Focalboard ≈26k **Apache-2.0**（停滞） | B 借鉴，勿依赖 | 卡片属性 |
| 目标-项目关联 | operately ≈500 **Apache-2.0** | B（供模块 08 同步） | Check-in 复盘节奏 |
| Gantt 时间条 | 无高 star MIT 大库（plane 式 Gantt 需自研或有待核实许可的 frappe-gantt） | **C 低优先级/自研** | 个人工具迭代燃尽图更实用 |
| 导出/备份 | — | C 自研 JSON 项目包 | 对接 §50 .rdw 骨架 |

**采纳原则**：嵌入应用的微型组件优先进 MIT/Apache；大型候选（plane/AppFlowy）本轮不引入依赖，仅作为交互/数据模型参照，避免"为了一个模块拖入整套系统"。

## 五、实施单元（按此顺序，逐个确认）

- **U1 结构与管理 ✅ 已实施**：项目页"建筑"标签页（建筑→弱电间 增删改、删除保护）；概览补"自动进度 + 设计问题 + 最近修改"。另按用户决策全局去除"区域"层级（Point = 设备名称/建筑/弱电间/数量，存储 v5）。
- **U2 任务与日程 ✅ 已实施**：任务 tab 升级为「列表 / 看板（@dnd-kit 拖拽）/ 里程碑（frappe-gantt 时间线）」三视图 + 新建任务条；日程 tab 接入 FullCalendar（周/月/列表，zh-CN），替代无法修复的 schedule-x。
- **U3 ✅ 已实施**：设备 tab（TanStack Table + React Query，按系统合计）；版本 tab（revisions 快照启用：点位增删改自动写快照 + 时间线 + 相邻版本字段级 diff）；文档 tab（轻量 CRUD，富文本随模块 07）；复盘 tab（表单 + 历史，**沉淀为 Document(type=review_record)，KnowledgeItem 桥接留待模块 07**）；项目轻量备份导出/导入（.rdw.json，按 id 合并导入）。

## 六、数据模型变化（U1-U3 汇总）

- `project_systems.progress`：算法扩展（任务权重），字段不变；
- `revisions`：启用（点位变更写入）；无新表；
- `documents`：类型枚举增加 `review_record`；无新表；
- 备份：导出 JSON 文件（本地下载/导入），非数据库变更。

## 七、验收标准（U1 先验）

- [ ] 项目页能完整管理 建筑 → 区域/弱电间（建/改/删/被引用保护）；
- [ ] 概览自动进度 = f(系统进度, 任务完成率, 清单预算状态)，不手填；
- [ ] 设计问题区能展示 ValidationEngine 校核结果；最近修改列出本轮点位/清单变动；
- [ ] 既有功能回归：点位页结构管理、推导/清单/预算、设备中心不受影响；
- [ ] `npm run build` + `npm run lint` 0 error；浏览器复验全流程。

## 八、待你确认

1. 实施范围：**先做 U1**（建筑标签页 + 概览增强），确认后我开始；U2/U3 逐个再确认，还是本次连 U1-U3 一起排期？
2. 日程组件：确认引入 **schedule-x（MIT，npm 依赖）**？
3. 任务 tab 需要**看板视图**（复用现有列表即可，还是本模块就要看板/Gantt）？

确认后开始实施本模块，不跨越到其他模块。