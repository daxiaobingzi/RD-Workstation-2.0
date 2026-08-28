# ARCHITECTURE.md

RD Workstation 2.0 · V2.1 架构基线

## 0. 重构铁律

> **本轮重构只改变代码组织方式，不改变业务行为；所有领域逻辑、计算规则和页面行为以现有版本为基准，第三批功能在重构完成后再进入。**

执行方式：M1（骨架搬迁）→ M2（拆大文件：engines/services/seed/device-center/system-design）→ M3（Repository 接口）→ M4（lint/文档/回归）。每个 Milestone 完成必须满足：功能行为不发生变化。

## 1. 目录契约

```text
src/
├── main.tsx                        # 入口：数据层初始化
├── app/                            # router.tsx / layout.tsx / route-placeholders.tsx
├── components/
│   ├── ui/                         # 基础 UI（不承担业务）
│   ├── charts.tsx                  # ECharts 封装
│   └── data-linkage-strip.tsx      # 跨 feature 复用的数据联动条
├── types/
│   └── domain.ts                   # 冻结 Schema，唯一权威；只放持久化领域实体
├── db/
│   └── memory-db.ts                # useDB(Zustand+localStorage) + MemoryRepository 实现 + repository 单例
├── repositories/
│   └── repository.ts               # Repository 接口：表级泛型、同步、覆盖现有全部能力
├── services/                       # 业务编排层，只依赖 Repository 接口（不直连 store）
│   ├── project/system/point/design/bill/budget/device/misc.service.ts
│   ├── device.{catalog,pricing,grade}.ts   # DeviceService 聚合入口 = {...catalog,...pricing,...grade}
│   └── ctx.ts                      # EngineCtx 单例（只读访问）
├── engines/                        # 纯计算层，无副作用
│   ├── expr.ts / ctx.ts            # 表达式求值 / 变量构建
│   ├── design/selection/pricing/bill/budget/validation.engine.ts
│   ├── goal/scheduling.engine.ts   # 第三批目标/日程
│   └── default-rules.ts            # 程序内置 fallback 默认规则（不是规则数据库）
├── seed/                           # seedDB 组装：base/devices/prices/rules/demo-project
└── features/                       # 页面业务域，UI 状态类型留在 feature 内 *.types.ts
```

## 2. 依赖方向

```text
React(页面)
  → services（业务编排）
  → Repository<T>（repositories/repository.ts）
  → useDB / MemoryRepository（db/memory-db.ts）
计算经 engines（通过 EngineCtx 只读访问表）。
```

禁止反向依赖；禁止页面绕过 Service 直接改库（只读订阅除外）。

## 3. Repository 契约

```ts
export interface Repository {
  readonly db: DB                                  // 整库快照（只读）
  getTable<T>(table): T[]
  getById<T>(table, id): T | undefined
  where<T>(table, pred): T[]
  insert<T extends Row>(table, row): void
  insertMany<T extends Row>(table, rows): void
  update(table, id, patch): void
  remove(table, id): void
  removeMany(table, pred): void
  replace<T extends Row>(table, rows): void
}
```

同步接口。SQLite/Tauri 阶段替换 `db/memory-db.ts` 的导出实现即可，Service 与页面零改动。

## 4. 规则优先级

```text
项目规则 > 系统规则 > 全局 DesignRule（design_rules 表）> engines/default-rules.ts
```

数据库存「事实」，Engine 算「应该多少」；默认值不得散落进引擎/页面。

## 5. 边界纪律

- 加字段前先问：数据库实体属性，还是 UI 临时状态？UI 状态只进 `feature/*.types.ts`。
- 实体变更必须同步更新 seed 与 demo 数据，才允许进入冻结 Schema。
- 引擎不新增魔数硬编码，一律走 design_rules 或 default-rules。
- 重构期间禁止"顺手优化"：行为以既有版本为基准。