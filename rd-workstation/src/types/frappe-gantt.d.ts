declare module 'frappe-gantt' {
  export interface GanttTask {
    id: string
    name: string
    start: string
    end: string
    progress?: number
    dependencies?: string
    custom_class?: string
  }
  export class Gantt {
    constructor(element: string | HTMLElement, tasks: GanttTask[], options?: Record<string, unknown>)
    refresh(tasks: GanttTask[]): void
    change_view_mode(mode: 'Day' | 'Week' | 'Month'): void
    change_zoom(zoom: number): void
    showPopup?(): void
  }
  export default Gantt
}