import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/router.tsx'
import { useDB } from './db/memory-db'
import { seedDB } from './seed'

// 初始化数据层：无持久化数据则播种演示数据
useDB.getState().init(seedDB)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
