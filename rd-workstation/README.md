# rd-workstation

RD Workstation 2.0 —— 弱电/智能建筑设计师的「设计 → 推导 → 清单 → 预算」一站式工作台（Web 先行版）。

## 技术栈

React 19 · TypeScript · Vite 8 · Tailwind v4 · Zustand · React Router 7 · ECharts 6 · SheetJS

## 运行

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # tsc -b && vite build
```

## 结构

- `src/domain`：Types（冻结 Schema 43 表）/ Repository(useDB) / Engines（推导·选型·清单·预算·校核）/ Services
- `src/pages`：今日工作台 / 项目 / 设计 / 设备中心 / 清单 / 系统设计工作区
- 数据层为内存 Store + localStorage，接 Tauri + SQLite 时仅替换 Repository 实现