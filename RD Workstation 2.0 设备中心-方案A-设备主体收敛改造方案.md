# RD Workstation 2.0 · 设备中心 方案A：设备主体收敛改造方案

> 目标：把 2.0 设备中心的设计逻辑收敛回 Vue 初版"设备类型为主体、品牌型号/价格/配比长在设备上"的心智，同时保留 2.0 已有的工程资产（内存库 / RQ / TanStack / 选型引擎 / 系统设计链路）。
> 原则：不改表结构（除一个可选新字段外）、不动其他模块的业务行为、按 U1→U2→U3 分步实施，每步完成后保证 build / 路由 / 数据加载 / 功能链路可用。

---

## 1. 方案背景与目标

### 1.1 为什么方案 A
- 用户认可 Vue 初版（`daxiaobingzi/RD-Workstation`）的数据库逻辑：**设备类型是核心实体**，品牌型号是其"可选配置行"，单价/档位/参数直接挂在配置行上，数量配比/定额材料也是设备属性；选型时按 预算档位 × 品牌策略 在配置行中取一个。
- 2.0 现状是"型号为中心"：新增型号即新建 Product 且 `Product.name = 型号名`（`services/device.catalog.ts#addModel`），品牌退化为型号单默认属性，价格抽成独立四类型域，数量推导外移到全局 `design_rules` 规则引擎——设备的"主体性"丢失。
- 方案 A 在**现有 5 层结构上做语义收敛**，不推翻数据模型、不迁移库、不改其他模块接口。

### 1.2 达成后的形态（一句话）
> 设备中心 = 系统目录（树）→ 设备类型（Product）为主体 → 其下"品牌型号配置行"（品牌+型号+档位+参数+参考价）→ 设备级数量链/定额材料 → 全局价格治理（按品牌批量调价/替换）。

---

## 2. 现状盘点（代码锚点）

| 环节 | 现状实现 | 问题 |
|---|---|---|
| 设备类型实体 | `Product`（`types/domain.ts`），name 已是"高清枪型摄像机"这类设备类型名（seed 中） | 但运行期 `addModel` 会**新建同名 Product（name=型号名）**，导致设备类型与型号混淆 |
| 型号实体 | `ProductModel`（model/规格/单位/grade_code/参数/状态） | 型号作为最细实体存在，本身没问题 |
| 品牌 | `model_brands`（model↔brand 单默认） | 心智上应该是"设备类型下多个品牌备选"，实际是"一个型号绑定一个品牌"——多品牌备选 = 同设备类型下加多个型号即可，**品牌关联本身不需要多值化** |
| 价格 | `prices`（model_id + reference/market/supplier/project 四类 + 有效期/来源/供应商） | 引擎实际只消费 reference（`device.pricing.ts#price()`），其余三类无消费端；四类型 UI（`PriceEditor.tsx`）稀释"点开设备看到价"的直觉 |
| 数量推导 | `design_rules`（全局、按 system_id）经 `DesignEngine.run` 计算 camera/poe/nvr/hdd/agg/mount/cable | 与设备字典分离，设备中心"看不到这台设备怎么被算数" |
| 定额材料 | `device_materials`（挂 product_id，每点位配比）——**与 Vue quota 同构，保留** | 无设备中心入口之外的问题 |
| 点位"设备名称" | `DeviceNameSelect` 返回 product_id，展示 Product.name（设备类型名）——**与 Vue 语义一致** | 基本无需改动，只需在展示上补充型号数/品牌提示 |
| 选型 | `SelectionEngine`：camera 按 product 分组选型；其余 kind→family 硬编码映射 | 符合"设备类型+档次+方案"语义，保留 |
| 档次 | `grades` 表 + `model_grade_bindings`（绑定优先 + grade_code 兜底），3 档 | 已确认保持 3 档，档位数不作调整；对齐的是"档次是配置行属性"的逻辑 |
| 目录结构 | `device_categories`（挂 system_id）→ `product_families` → `products` | 与 Vue"子系统→设备"同源，保留现系统目录树，见待确认项 D |
| 预警/治理 | `device.grade.ts#stats` 缺价/缺档/停用被引用；批量调价按勾选型号 | 缺档口径需改为"设备类型×档位"；批量调价需增加"按品牌"维度（对齐 Vue 价格治理） |

### 2.1 关键结论
1. **Product 本来就是"设备类型"**——方案 A = 纠正运行期行为（`addModel` 不再偷建 Product），并在 UI/心智上把 Product 扶正为主体。
2. **"多品牌备选"不需要改 `model_brands` 多值**：同设备类型下多个型号各挂不同品牌即可，与 Vue `devBrands` 数组完全同构。
3. **数量回流是唯一需要新数据字段的点**：给 `Product` 增加可选 `chain_json`（宽松结构，对应 Vue 的 chain/ratio），引擎"设备链优先、规则兜底"。
4. 所以整体改动集中在**设备域内部**（domain 语义 + service + 设备中心页面 + seed），不触碰系统设计 / 项目 / 预算 / 目标等模块。

---

## 3. 目标数据模型（实体职责重定义）

| 实体 | 职责（收敛后） | 字段变更 |
|---|---|---|
| `Product` | **设备类型**（唯一定义：名称/规格/单位/类别，如"网络摄像机(枪式)"） | + 可选 `chain_json?: string`（数量链配置，U3） |
| `ProductModel` | **品牌型号配置行**（一个设备类型下的一个品牌/型号/档位/参数/参考价） | 不变；骨架字段保持 model/specification/unit/grade_code/parameter_json/status |
| `ModelBrand` | 型号↔品牌关联（一行一品牌，不要求多值） | 不变（保留 is_default，仅作历史兼容） |
| `Price` | **主用 reference（选型/报价价）**；market/supplier/project 保留为折叠台账区 | 不变（不删表、不删已有数据） |
| `DeviceMaterial` | 设备单点定额材料（按点位） | 不变 |
| `chain_json` | 设备级数量推导链：mode(carry/mul/fixed) + capacity + source(front/指定设备) + factor/reserve/round | 新建（仅作用于设备推导，缺省回落 design_rules） |
| `design_rules` | 降级为"设备链未配置时的兜底规则" | 不变（种子数据改为与链初始化一致） |

---

## 4. 实施单元划分

### U1 · 领域层收敛（行为修正，UI 不动）
**目标**：语义修正 + API 拆分，保证现有设备中心页面行为不变（除新增型号不再产生重复 Product）。

改动点：
- `types/domain.ts`：`Product` 注释与职责说明改为"设备类型"；声明可选 `chain_json`（U3 使用，本 U 只加类型不留逻辑）。
- `services/device.catalog.ts`：
  - `addModel` 拆为两级入口：`resolveDeviceType({name,spec,unit})→productId`（按 name 命中已有则不新建）+ `addModel({product_id, model, brand_id, grade_code, parameter_json, unit, status})`。
  - 新增 `addDeviceType` / `updateDeviceType`（调整 Product 自身字段，如名称/规格/单位/类别）。
  - `DeviceProductOptions` 保持以 product 为行（点位选择器数据源不变）。
- `seed`（`seed-devices.ts`）：把表数据按"设备类型为主体"重构——`products` 用设备类型名，`product_models` 直接落到各设备类型下并补齐品牌/价格/档位；价格种子（`seed-prices.ts`）统一到 reference。
- 验收：`tsc`、`vite build`、`oxlint` 通过；设备中心打开、选择型号、编辑、新增型号（不再产生重复设备类型）、删除保护、搜索/过滤行为与改造前一致；demo 项目点位/选型/清单数据加载正常。

### U2 · 设备中心 UI 收敛（设备主体 + 品牌型号配置行）
**目标**：页面交互对齐 Vue"设备类型 → 品牌型号配置行"心智，价格收敛回参考价主档。

改动点：
- `features/device-center/DeviceCenterPage.tsx`：
  - 目录树不变；中栏主表改为**设备类型为主行**（列：设备类型 | 规格 | 单位 | 品牌备选数 | 型号数 | 档位覆盖 | 参考价区间 | 状态 | 操作），**点击/双击设备类型行展开其下品牌型号配置行**（配置行展开列：品牌 | 型号 | 档位 | 参数 | 参考价 | 状态/操作）——即 Vue 价格工作台"设备分组折叠"的层级版（已确认选此形态）。
  - 详情面板改为"设备类型详情 + 品牌型号配置表"（每个配置行：品牌 | 型号 | 档位 | 参数 | 参考价 | 停用/删除），增/删/改配置行即 Vue 的"在本设备下添加型号"。
- `components/ModelFormModal.tsx`：改为**两级表单**——设备类型行（名称/规格/单位/类别）+ 型号行（型号/品牌/档位/参数）；品牌下拉从品牌池联想，允许"未收录品牌一键入池"（对齐 Vue 品牌池联动）。
- `components/PriceEditor.tsx`：**参考价为主档**（显眼、即改即存、标注"推导选型采用"），market/supplier/project 收进"台账价"折叠区，不再平铺 4 块。
- `components/GradeBindingEditor.tsx`：保留绑定交互，补充"该设备类型各档可用型号数"（口径从族改到设备类型级）。
- `DeviceAnalytics` / `DeviceImport`：批量导入按设备类型归位（设备名→型号行），数量/金额汇总以设备类型为行。
- 验收：浏览器全链路——目录选设备类型→展开配置行→改品牌/档/价即时生效、缺价/缺档预警条正确、批量调价（保留按勾选 + 新增按品牌入口）、价格影响分析、CSV 导出按类别/设备类型命名；点位"设备名称"选择器仍只列设备类型。

### U3 · 数量回流 + 价格治理对齐 + seed 重建（数据驱动闭环）
**目标**：设备中心"打开即见这台设备怎么被算数"；价格治理按品牌；demo 全链路一致。

改动点：
- `types/domain.ts` + `services/device.catalog.ts`：实现 `chain_json` 读写与归一化（`ensureDeviceChain`，语义照搬 Vue `calc.js#ensureDeviceChain`：mode=carry/mul/fixed，source=front/指定设备，factor/reserve/round）。
- `engines/design.engine.ts`：**设备链优先**——某目标类型（poe_switch/nvr/hdd/aggregation/mount/cable…）若命中产品族对应设备的链配置，按链计算；否则回落 `design_rules`。链配置缺省值由现有 6 条规则初始化（R-CAM-POE→POE 链、R-CAM-NVR→NVR 链…），保证首版推导结果与现状一致。
- 设备中心新增"数量逻辑"配置区（`ChainQuotaPanel`）：展示/编辑该设备类型的链（承接来源、每台承载、冗余/取整），并回显定额材料（对齐 Vue：设备卡片上即见 quota + chain）。
- `device.grade.ts#stats`：缺档口径改为"设备类型×档位"（对应 Vue 缺档体检），新增"按品牌批量调价 + 品牌替换"service（对齐 `PriceGovernDialog`：pct + 取整；停产换主供）。
- `seed` 全量重建（`seed-devices/seed-prices/seed-rules/seed-demo-project`）保持：演示项目点位设备名=设备类型、选型/清单/预算金额与改造前等价。
- 验收：`tsc` / `build` / `lint`；全链路——设计→推导（链优先）→清单→预算→版本→校核闭环数值不变；价格治理按品牌批量调价取整正确、品牌替换全局迁移；缺档预警按设备类型展示。
- （可选）`PriceImpactModal`：增加按品牌汇总差额分组。

---

## 5. 兼容性与风险

| 风险 | 缓解 |
|---|---|
| `addModel` 语义改变导致旧页面（点位/选型）取到重复产品 | U1 先做"命中复用"，旧数据（已存在 product）不受影响 |
| 链推导首版数值与现规则引擎不一致 | U3 链缺省值由现有 6 条规则逐条初始化，首版对齐后再开放自定义 |
| seed 重建影响 demo 项目展示 | 重建按"点位设备名=设备类型名"保持点表、选型 model、清单金额等价；验收含数值比对 |
| 删除保护/引用统计口径切换（型号→设备类型） | `modelInUse` 与预警口径同步改为"设备类型引用 = 其下型号引用并集" |
| 档位 / 目录形态 | 已确认：保持 3 档、保留现有系统目录树（见 §6） |

---

## 6. 已确认项与待确认项

### 已确认（2026-08-28）
- **A. 主表展示形态**：设备类型为主行，点击/双击展开其下品牌型号配置行。
- **B. 台账价（market/supplier/project）处置**：保留表结构与数据，UI 折叠收纳（参考价为主档）。
- **C. 档位**：保持 3 档、档位数不作调整；对齐的是"档次是配置行属性"的代码逻辑（非技术栈调整）。
- **D. 目录形态**：保留现有系统目录树（与 Vue 子系统同源映射）。

### 待确认
- **E. 实施顺序**：U1 → U2 → U3 逐步执行，每个单元完成后验收并汇报。——默认按此顺序，确认后开始。

---

（等待确认 E 后按 U1 开始实施；方案期间不修改任何代码。）