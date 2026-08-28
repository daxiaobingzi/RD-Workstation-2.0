import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

/** 图表系列色（设计 Token） */
export const CHART_PALETTE = ['#2F5AF7', '#12A5BE', '#7A5AF7', '#E08E0B', '#16A34A', '#8AA1B8']

export const CHART_TEXT = { color: '#5C748C', fontSize: 11 }
export const CHART_AXIS = { axisLine: { lineStyle: { color: '#DCE6F1' } }, axisLabel: CHART_TEXT }

/** ECharts React 封装：按设计 Token 默认主题，自动 resize */
export function Chart({
  option,
  height = 260,
  className,
}: {
  option: echarts.EChartsOption
  height?: number | string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    chartRef.current = chart
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, true)
  }, [option])

  return <div ref={ref} style={{ height }} className={className} />
}
