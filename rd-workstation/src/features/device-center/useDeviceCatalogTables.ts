import { useDBTables } from '../../db/selectors'
import { T } from '../../types/domain'

/**
 * 设备中心目录数据域：集中声明影响设备类型目录展示的主数据表。
 * 页面通过该 Hook 订阅目录域，而不是订阅整个数据库。
 */
export function useDeviceCatalogTables() {
  const [products, productModels, modelBrands, brands, prices, grades, productFamilies] = useDBTables([
    T.products,
    T.product_models,
    T.model_brands,
    T.brands,
    T.prices,
    T.grades,
    T.product_families,
  ] as const)

  return {
    products,
    productModels,
    modelBrands,
    brands,
    prices,
    grades,
    productFamilies,
  }
}
