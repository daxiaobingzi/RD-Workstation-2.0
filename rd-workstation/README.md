# rd-workstation

RD Workstation 2.0 —— 弱电/智能建筑设计师的「设计 → 推导 → 清单 → 预算」一站式工作台（Web 先行版）。

## 技术栈

React 19 · TypeScript · Vite 8 · Tailwind v4 · Zustand · React Router 7 · ECharts 6 · SheetJS

## 运行

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # tsc -b && vite build
npm run lint    # oxlint
```

## 结构（V2.1 架构基线）

```text
src/
├── main.tsx                    # 入口（数据层初始化：useDB.init(seedDB)）
├── app/                        # 路由 / 布局 / 占位页
├── components/
│   ├── ui/                     # 基础 UI 组件（button/badge/table/dialog…）
│   ├── charts.tsx              # ECharts 封装
│   └── data-linkage-strip.tsx  # 数据联动条（点位→设备→清单→预算）
├── types/domain.ts             # 冻结 Schema（唯一权威，持久化实体）
├── db/memory-db.ts             # useDB（Zustand store + localStorage）+ MemoryRepository 实现
├── repositories/repository.ts  # 表级泛型同步 Repository 接口（SQLite 阶段替换实现）
├── services/                   # 业务编排层：project/system/point/design/bill/budget/device/misc
│   └── device.{catalog,pricing,grade}.ts   # DeviceService 内部三模块（聚合导出）
├── engines/                    # 纯计算层：设计/选型/定价/清单/预算/校核 + expr/ctx/default-rules
├── seed/                       # 种子数据：base/devices/prices/rules/demo-project（开发=演示，生产=基础）
└── features/                   # 页面按业务域组织：device-center/system-design/projects/today/design/bills
```

## 分层与依赖方向

```text
React(页面)
  → Service（业务编排）
  → Repository<T>（表级 CRUD；Web 阶段 MemoryRepository / 未来 SqliteRepository）
  → DB（内存对象 + localStorage / 未来 SQLite）

计算请走 Engine；规则数据存 design_rules 表 + default-rules.ts 内置 fallback。
```

## 约定

- UI 临时状态（activeTab/drawerOpen/modalState…）放各 feature 内 `*.types.ts`，禁止进入 `types/domain.ts`。
- 数据层为内存 Store + localStorage，接 Tauri + SQLite 时仅替换 Repository 实现，上层不变。