# RD Workstation 2.0 · 模块 08「目标」顶层规划与开源复用方案（V2 · U1/U2/U3 完整设计版）

> 基线：《RD Workstation 2.0 开放式弱电智能化个人工作台实施方案.md》§23.2 / §23.4 / §23.1 与《模块顶层规划与开源复用方案 V2.3》模块 08 / §122 个人工作流（目标→任务→日程→今日执行）。
> 用途：本模块独立规划，确认后实施。个人自用场景，许可不做一票否决（详见总索引文档）。
> 路线（用户已确认）：**全自研 + 借用 open-source 的功能设计**——不引入任何套件依赖，把 operately 的 OKR 机制以自有 React 代码复刻；自动统计硬核自研 GoalEngine。

---

## 一、模块定位

目标是个人工作流的**起点**：`年度 → 季度 → 月度 → 周 → 任务`（§23.4）。
个人工作流链路 = **目标 → 任务 → 日程 → 今日执行 → 完成 → 复盘**（§122），目标页是这条链路的源头：制定目标、拆解 KR/子目标、挂接任务，任务完成反向推进目标进度；支持"手动记录进度"与"系统自动统计"（如"2026 完成 20 个项目"按项目状态自动算，见 V2.3 规划基线模块 08）。

目标页职责 = ①四层级目标树与 CRUD；②KR 进度（百分比/里程碑）；③目标-任务联动（Task.goal_id）；④数据自动统计目标（GoalMetric + GoalEngine）；⑤为"今日"页目标进度栏提供数据源。

## 二、现状与差距（评审已有代码）

| 能力 | 现状 | 差距 |
|---|---|---|
| 领域模型 Goal | ✅ [domain.ts](file:///e:/02%20AI%20outpt/Trae%20work/RD%20Workstation%202.0/rd-workstation/src/types/domain.ts#L358-L370)：`parent_goal_id / name / period_type(year\|quarter\|month\|week) / start_date / end_date / target_value / current_value / status` | 字段已够用；`goal_type` 等枚举未形式化 |
| GoalMetric（KR/自动统计源） | ✅ 表已建（`goal_id / metric_type / source_type / source_query / target_value / weight`） | **零使用**，纯闲置 |
| GoalEngine | ✅ [goal.engine.ts](file:///e:/02%20AI%20outpt/Trae%20work/RD%20Workstation%202.0/rd-workstation/src/engines/goal.engine.ts)：`completed_projects / active_projects / knowledge_count / habit_completion` 四类查询 | query 少、未接任何 Service |
| 目标-任务联动 | ✅ `Task.goal_id` 字段存在，[TaskService.add](file:///e:/02%20AI%20outpt/Trae%20work/RD%20Workstation%202.0/rd-workstation/src/services/misc.service.ts#L39-L50) 可写 | `setStatus/toggle` 完成后**不更新目标进度**，无联动逻辑 |
| 页面 | /goals 为占位页 | 无目标中心页、无 CRUD、无目标树 |
| 今日页露出 | ✅ [TodayPage](file:///e:/02%20AI%20outpt/Trae%20work/RD%20Workstation%202.0/rd-workstation/src/features/today/TodayPage.tsx#L164-L181) 已有"目标进度"栏（只读 top2） | 待 U2/U3 完善（按周期集计、跳转目标页） |
| Seed | ✅ `goal_q3` / `goal_q3_subs` 两条 | 缺周/月层级与 task 关联样例 |

**结论**：数据模型与引擎骨架已提前就位，本模块主要是**把闲置能力接缝起来**（Service + UI + 联动 + 自动统计），无新表。

## 三、顶层设计

### 3.1 数据模型（复用现有 domain，无新表）
- `goals`：形式上仅约束既有字段口径。
  - `period_type`：year / quarter / month / week（§23.4 四级）。
  - `goal_type`：`objective`（汇总型父目标）｜`milestone`（里程碑型：current/target 或百分比手填）｜`metric`（数据统计型：绑定 `GoalMetric` 自动算）。
  - `status`：draft / active / archived。
  - 进度口径（不新存冗余字段）：父目标进度 = 子目标加权平均（类似项目进度算法）；叶子目标取 `current_value / target_value`（手动或 metric）。
- `goal_metrics`：启用。`metric_type`=`count|percent|sum`，`source_type`=`project|task|knowledge|habit|custom`，`source_query` 交 GoalEngine。
- metric 型目标：绑定一条 GoalMetric，`current_value` 由 GoalEngine 实时计算展示（派生层自动，不固化冗余）；用户可手动"覆盖"一次值（事实层）。

### 3.2 页面结构（`features/goals/`，新模块）
- **目标中心页 `/goals`**：
  - 顶部周期区：年/季/月/周 四级筛选（segmented）+ 具体期选择（如 2026 → Q3），联动过滤目标列表。
  - 主体：**目标树**（按 `parent_goal_id` 分组缩进、可折叠），行 = 名称 + 周期徽标 + 进度条 + 状态 + 关联任务数 + 操作（编辑/归档/删除，受删除保护）。
  - CRUD 弹窗：名称/描述/周期类型与起止/父目标选择/目标值与当前值（手动型）/GoalMetric 配置（metric 型，U1 只保存、U3 生效）。
  - 详情展开行（U2 起）：描述 + 关联任务列表（新建挂接 / 从全量任务勾选） + "记一笔进展"（U3 check-in 轻量版）。
- **今日页露出（U2 升级基础、U3 完整）**：目标进度栏按"本周/本月活跃目标"集计，点击跳转 `/goals`。

### 3.3 不与既有已验证功能冲突
不改：任务列表/看板/里程碑三视图、项目进度算法、设备中心、设计推导链。对 `TaskService.setStatus/toggle` 只做**增量扩展**（完成后额外推进关联目标），不动既有任务卡片行为。

## 四、开源复用决策（GitHub 已核实，个人自用场景）

### 4.1 候选总表

| 能力 | 候选 | 许可证 / 状态 | 结论 | 可借用子模块 |
|---|---|---|---|---|
| OKR 数据模型与进度自动计算 | **operately** | **Apache-2.0**，约 4.4k commits，v1.8（2026-07）活跃 | **B 借鉴设计**（不依赖、不部署，纯复刻） | 见 4.2 功能对标表 |
| 轻量目标卡片/看板 | **Focalboard** | **MIT**，mattermost-community 维护、2023 起基本冻结 | **B 借鉴**，勿依赖 | 卡片属性、多视图（概念参考） |
| 企业级 OKR（备选整体部署） | OpenProject | **GPL-3.0**，约 15.9k stars，活跃 | **B 个人自用可选** | OKR 层级/周期/仪表盘（部署成本高，不推荐） |
| 国内对齐树 OKR | zhouwenjun-hub/okr | 未标注商用友好许可，Vue2 + Spring Boot | **C 不用** | "对齐树"视觉 → 本项目目标树平替 |
| Obsidian OKR 插件 | obsidian-okr-manager | 绑定 Obsidian | **C 不用** | 本地 Markdown 存储思路（无关） |
| 现有组件复用 | 本仓库 Progress/Tabs/Dialog/TanStack Table/PageHeader | 项目内 MIT 依赖 | **A 直接复用** | 进度条、目标列表、CRUD 弹窗 |

### 4.2 operately 功能对标与自研落地点（全自研的"抄谁、抄哪"清单）

| operately 机制 | 吸收价值 | 本产品落地点 | 实施单元 |
|---|---|---|---|
| Objective/KR 层级（O 下挂 KR） | 高：结构化拆解 | `Goal.parent_goal_id` 目标树（O=父目标，KR=子目标） | U1 |
| 周期管理（year/quarter 时间框架） | 高：统一节奏 | `period_type + start/end_date` + 周期筛选 UI | U1 |
| 进度自动上卷（子项/关联项目→父目标加权） | 高：免手填父级 | 父目标 = 子目标加权平均（与项目进度同构） | U1 计算、U2 联动打通 |
| 关联项目推进目标（project→goal 引入进展） | 中：口径清晰 | 收敛为「任务完成推进叶子目标」（计数口径，任务粒度更细） | U2 |
| Goal check-in（定期记录进展/脚本） | 中：轻量复盘节奏 | "记一笔进展"：时间+数值+备注，落 `activity_logs`（已有表，不长新表） | U3 |
| 目标状态指示（on-track/at-risk） | 低-中：一眼看风险 | `status` + 派生"按计划/落后"徽标（逾期&未完成即落后） | U3 |
| 多团队/权限/评论/Company 空间 | 无（个人工具） | **剥掉** | — |

### 4.3 采纳原则
目标模块无高 star 嵌入式 React 开源件可依赖，**自研为主（C）+ operately 设计复刻（B）+ 零新增 npm 依赖**；若后续要目标趋势图，复用现有 `components/charts.tsx`。

## 五、实施单元（按此顺序，逐个确认实施）

### U1 · 目标中心基础（目标树 + CRUD + 手动进度）
- **GoalService**（新增 `services/goal.service.ts`，纯函数 Service，Repository 接口不变）：
  - `list()`、`tree()`（按 parent 分组）、`add()`、`update()`、`remove()`（删除保护：有子目标或有关联任务拦截）；
  - `progress(goal)`：父=子项加权平均，叶子=current/target，导出统一 `{ value, target, pct }`；
  - `byPeriod(type, label)`：按周期类型+期过滤。
- **`/goals` 页面**（新增 `features/goals/GoalsPage.tsx` + 弹窗组件，替换 router 占位）：
  - 周期筛选（年/季/月/周 segmented + 期选择）；目标树行列表（缩进+折叠）；CRUD 弹窗（含父目标选择）；删除保护确认；
  - 进度用现有 `<Progress>`；列表用现有 Card/Stack 布局（目标量小，**不用 TanStack Table**，避免杀鸡用牛刀）。
- **GoalMetric 表单**：metric 型目标可保存 `source_type/source_query/target_value`（只存不算）。
- **验收**：四层建树/折叠/CRUD/删除保护；进度显示=子项加权或 current/target；build+lint 0 error；既有页面回归。
- **不动**：任务、项目、今日页。

### U2 · 目标 - 任务联动
- **TaskService 增量扩展**（`misc.service.ts`，仅追加逻辑）：
  - `toggle/setStatus` 置 done 时：若 `t.goal_id` 存在 → 叶子目标 `current_value+1`（任务完成计数口径，可后续改权重）并自动上卷父目标；
  - 反勾（done→todo）→ 计数回退，保持一致性。
- **目标详情展开行**：关联任务列表（“新建任务挂接”写 goal_id / “从全量任务勾选”批量挂接/解绑）；Plane/Cycles 式"目标下沉淀任务"。
- **今日页升级**：目标进度栏改为按周期活跃集计（最近一级活跃目标 + 已完成百分比），点击跳转 `/goals`。
- **验收**：任务完成→叶子+1→父级加权联动；反勾回退；目标详情可挂接/解绑任务；今日页数字与 /goals 一致。
- **不动**：任务三视图渲染、项目页。

### U3 · 数据自动统计 + Check-in 复盘
- **GoalEngine 扩展**（[goal.engine.ts](file:///e:/02%20AI%20outpt/Trae%20work/RD%20Workstation%202.0/rd-workstation/src/engines/goal.engine.ts)）：
  - 签名加周期窗口：`compute(ctx, sourceQuery, from?, to?)`（兼容现有调用，默认不限窗口）；
  - 新增 query：`project_completed_by_period`、`task_done_by_period`（按 completed_at 落窗口）、`knowledge_added_by_period`、`habit_completion_by_period`；保留现有 4 类。
  - 纯函数输入→输出，不持状态（项目 Engine 铁律）。
- **metric 目标生效**：绑 `GoalMetric` 的目标由引擎实时算 `current_value`；提供“手动覆盖一次”入口（事实层优先于派生层）。
- **过 "记一笔进展"（check-in 轻量版）**：目标详情内时间+数值+备注 → `activity_logs`（复用已有表）；展示最近 5 条时间线。
- **状态徽标**：按 deadline + 进度派生"按计划 / 落后"。
- **Seed 补齐**：周/月目标 + 与任务关联样例 + 1 条 metric 示例（如"Q3 完成 15 个项目"，绑定 project_completed_by_period）。
- **验收**：metric 目标随项目/任务状态实时变化；手动覆盖生效；check-in 时间线可回看；今日页"目标进度"正常。

## 六、数据模型变化（预期汇总）

- `goals` / `goal_metrics` / `tasks` / `activity_logs`：**均无新表、无新字段**，只形式化枚举口径；
- Seed：补充周/月目标与任务关联、metric 示例（demo 数据变更，非结构变更）。

## 七、验收标准（按单元逐项）

- **U1**：四层目标可建、树折叠正常；CRUD + 删除保护（有子目标/关联任务拦截）；进度=子项加权 / current÷target；GoalMetric 可保存读取；build+lint 0 error；既有功能回归。
- **U2**：任务置 done → 叶子目标+1 → 父级加权联动，反勾回退一致；目标详情可新建/勾选任务挂接；今日页集计与 /goals 一致。
- **U3**：metric 目标值随项目/任务/知识数据实时正确；覆盖值生效；"记一笔进展"时间线可回看；状态徽标正确；全链路浏览器复验无 Console 报错。

## 八、待你确认

1. 本版 V2（含 4.2 对标表与 U1-U3 细化）是否认可，按 U1 → U2 → U3 顺序开工？
2. U2 联动口径：默认"任务完成计数"（叶子 current_value+1），是否照此执行？
3. U3 的 check-in "记一笔进展"复用 `activity_logs` 表，认可吗（否则需评估新表）？

确认后开始实施 U1，不跨越到其他模块。