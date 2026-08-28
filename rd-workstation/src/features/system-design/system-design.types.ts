/** 系统设计工作区 UI 状态类型 */

/** 左侧步骤栏当前激活的步骤 */
export type ActiveStep =
  | 'condition'
  | 'params'
  | 'points'
  | 'devices'
  | 'derive'
  | 'topology'
  | 'bill'
  | 'budget'
  | 'note'
  | 'validate'

/** 右侧面板当前激活的标签 */
export type RightTab = 'attr' | 'ai' | 'check'