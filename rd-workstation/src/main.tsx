import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/router.tsx'
import { useDB } from './db/memory-db'
import { seedDB } from './seed'
import { QueryProvider } from './lib/query-provider'
import { DeviceService, FormatService } from './services'

// 初始化数据层：无持久化数据则播种演示数据
useDB.getState().init(seedDB)
// 幂等补齐设备类型编码：新 seed 与 localStorage 旧数据都统一生成 device_code
DeviceService.ensureDeviceCodes()
// 幂等补齐设备中心系统表：旧数据无 device_systems 时从标准系统派生
DeviceService.ensureDeviceSystems()
// 幂等补齐业态字典：旧数据无字典时播种常用业态，之后全部由用户自定义管理
FormatService.ensureDefaults()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
)
