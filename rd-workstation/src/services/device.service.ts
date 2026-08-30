import { DeviceCatalog } from './device.catalog'
import { DevicePricing } from './device.pricing'
import { DeviceGrade } from './device.grade'
import { DeviceCode } from './device.code'
import { DeviceSystemService } from './device.systems'

/** DeviceService 聚合入口：spread 合并内部模块，方法间的 this.xxx 调用经聚合对象解析 */
export const DeviceService = { ...DeviceCatalog, ...DevicePricing, ...DeviceGrade, ...DeviceCode, ...DeviceSystemService }