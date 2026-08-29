import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ClipboardPaste, FileSpreadsheet, Download, UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react'
import { DeviceService, type DeviceTypeView } from '../../../services'
import type { Brand } from '../../../types/domain'
import { Modal } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Textarea, Field } from '../../../components/ui/field'
import { Segmented } from '../../../components/ui/segmented'
import { Table, THead, TBody, TR, TH, TD } from '../../../components/ui/table'
import { toast } from '../../../components/ui/toast'

interface ImportRow {
  deviceTypeId: string
  deviceTypeName: string
  model: string
  brandId?: string
  gradeCode?: string
  refPrice?: string
  unit?: string
  genericHtml?: string
  detailHtml?: string
}

const GRADE_ALIAS: Record<string, string> = { 经济: 'economic', 经济型: 'economic', 标准: 'standard', 标准型: 'standard', 高端: 'premium', 高端型: 'premium' }

/** 解析一行文本为字段数组（支持双引号包裹段：引号内允许逗号，"" 表示引号本身）。
 *  富文本列（通用/详细参数）因此可含逗号；换行请用 <br>（textarea 为单行记录）。 */
function parseCsvRecord(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false
      } else cur += ch
    } else if (ch === '"') {
      inQ = true
    } else if (ch === ',' || ch === '，' || ch === ';' || ch === '；' || ch === '\t') {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function parseMatrix(rows: (string | number)[][], devTypes: DeviceTypeView[], brands: Brand[]): { rows: ImportRow[]; errors: { line: number; message: string }[] } {
  const brandByName = new Map(brands.map((b) => [b.name, b]))
  const matchBrand = (s: string): Brand | undefined => {
    const hit = brandByName.get(s)
    if (hit) return hit
    if (!s) return undefined
    // 未收录品牌一键归库（对齐 Vue 品牌池）
    const created = DeviceService.addBrand({ name: s, manufacturer_type: 'domestic' })
    brandByName.set(s, created)
    return created
  }
  const grade = (s: string) => GRADE_ALIAS[s] ?? s

  // 表头识别（可选）
  const headerMap: Record<string, number> = { 设备名称: 0, 品牌: 1, 型号: 2, 档次: 3, 参考价: 4, 单位: 5, 通用参数: 6, 详细参数: 7 }
  const first = (rows[0] ?? []).map((c) => String(c).trim())
  const hasHeader = first.some((h) => Object.keys(headerMap).some((k) => h.includes(k)))
  const src = hasHeader ? rows.slice(1) : rows

  const out: ImportRow[] = []
  const errors: { line: number; message: string }[] = []
  src.forEach((raw, idx) => {
    const line = (hasHeader ? 2 : 1) + idx
    const cell = (i: number) => String(raw[i] ?? '').trim()
    const model = cell(2)
    if (!model) { errors.push({ line, message: '缺少型号名称，已跳过' }); return }
    const devName = cell(0)
    if (!devName) { errors.push({ line, message: '缺少设备名称，已跳过' }); return }
    const devType = devTypes.find((t) => t.product.name === devName)
    const brandRaw = cell(1)
    const brand = brandRaw ? matchBrand(brandRaw) : undefined
    out.push({
      deviceTypeId: devType?.product.id ?? '',
      deviceTypeName: devName,
      model,
      brandId: brand?.id,
      gradeCode: cell(3) ? grade(cell(3)) : undefined,
      refPrice: cell(4) || undefined,
      unit: cell(5) || undefined,
      genericHtml: cell(6) || undefined,
      detailHtml: cell(7) || undefined,
    })
  })
  return { rows: out, errors }
}

/** 设备批量导入：列 = 设备名称, 品牌, 型号, 档次, 参考价, 单位, 通用参数, 详细参数。
 *  通用/详细参数为富文本且放最后两列：含逗号时整段用双引号包裹，换行用 <br>。 */
export function DeviceImportModal({ open, onClose, defaultSystemId }: { open: boolean; onClose: () => void; defaultSystemId?: string }) {
  const [mode, setMode] = useState<'paste' | 'file'>('paste')
  const [text, setText] = useState('设备名称,品牌,型号,档次,参考价,单位,通用参数,详细参数\n高清枪型摄像机,海康威视,DS-2CD2646FW,标准,1280,台,"<b>图像</b>：4MP","<p><b>镜头</b>：2.8-12mm</p>"')
  const [result, setResult] = useState<{ rows: ImportRow[]; errors: { line: number; message: string }[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const brands = DeviceService.brands()

  const parseText = () => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const matrix = lines.map((l) => parseCsvRecord(l))
    setResult(parseMatrix(matrix, DeviceService.deviceTypes(), brands))
  }

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }).map((r) => r.map((c) => String(c)))
      setResult(parseMatrix(matrix as (string | number)[][], DeviceService.deviceTypes(), brands))
    } catch {
      toast('文件解析失败，请使用 CSV 或 Excel', 'error')
    }
  }

  const importAll = () => {
    if (!result) return
    let ok = 0
    const failed: string[] = []
    for (const r of result.rows) {
      // 设备：已有则复用，否则按名称+通用参数+单位新建（归入当前子系统）
      let pid = r.deviceTypeId
      if (!pid) {
        const dev = DeviceService.addDeviceType({ name: r.deviceTypeName, system_id: defaultSystemId, category: 'front', specification: r.genericHtml, unit: r.unit })
        pid = dev.id
      }
      const created = DeviceService.addModel({
        product_id: pid, model: r.model, unit: r.unit, grade_code: r.gradeCode, status: 'active',
        detail_html: r.detailHtml || undefined, brand_id: r.brandId,
      })
      if (created) {
        const p = Number(r.refPrice)
        if (p > 0) DeviceService.setPrice(created.id, 'reference', p, { source: '批量导入' })
        ok++
      } else {
        failed.push(r.model + (r.deviceTypeId ? '' : `（新建设备：${r.deviceTypeName}）`))
      }
    }
    toast(`成功导入 ${ok} 个型号${failed.length ? `，${failed.length} 个失败` : ''}${result.errors.length ? `，跳过 ${result.errors.length} 条问题行` : ''}`)
    setResult(null)
    if (!failed.length) onClose()
  }

  const downloadTpl = () => {
    const blob = new Blob(['\uFEFF设备名称,品牌,型号,档次,参考价,单位,通用参数,详细参数\n高清枪型摄像机,海康威视,DS-2CD2646FW,标准,1280,台,"<b>图像</b>：4MP","<p><b>镜头</b>：2.8-12mm</p>"'], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '设备导入模板.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal open={open} onClose={onClose} title="设备型号批量导入" width={720}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Segmented
            options={[{ value: 'paste', label: '粘贴表格' }, { value: 'file', label: '上传 Excel' }]}
            value={mode}
            onChange={setMode}
          />
          <Button size="sm" variant="outline" onClick={downloadTpl}><Download className="size-3.5" />模板</Button>
        </div>

        {mode === 'paste' ? (
          <Field label="表头：设备名称, 品牌, 型号, 档次, 参考价, 单位, 通用参数, 详细参数（通用/详细参数为富文本放最后两列，含逗号时用双引号包裹，换行用 &lt;br&gt;；品牌未收录自动归库）">
            <Textarea className="h-36 font-mono text-[12px]" value={text} onChange={(e) => { setText(e.target.value); setResult(null) }} />
          </Field>
        ) : (
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-rule bg-surface-subtle/40 px-6 py-8 hover:border-accent/50 hover:bg-accent-soft/20"
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="size-7 text-accent2" />
            <p className="text-[13px] font-medium">选择 Excel / CSV 文件</p>
            <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = '' }} />
          </div>
        )}

        <div className="flex justify-end gap-2">
          {mode === 'paste' && <Button size="sm" variant="outline" onClick={parseText}><ClipboardPaste className="size-3.5" />解析预览</Button>}
          <Button size="sm" disabled={!result?.rows.length} onClick={importAll}>
            <UploadCloud className="size-3.5" />批量导入{result ? `（${result.rows.length}）` : ''}
          </Button>
        </div>

        {result && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              <CheckCircle2 className="size-3.5 text-ok" />解析 {result.rows.length} 条
              {result.errors.length > 0 && <span className="flex items-center gap-1 text-warn"><AlertTriangle className="size-3.5" />{result.errors.length} 条问题行</span>}
            </p>
            <div className="max-h-48 overflow-auto rounded-md border border-rule">
              <Table>
                <THead><TR><TH>设备名称</TH><TH>品牌</TH><TH>型号</TH><TH>档次</TH><TH>参考价</TH><TH>单位</TH></TR></THead>
                <TBody>
                  {result.rows.slice(0, 30).map((r, i) => (
                    <TR key={i}>
                      <TD>{r.deviceTypeName}{!r.deviceTypeId && <span className="ml-1 rounded bg-accent-soft px-1 py-px text-[10px] text-accent">将新建</span>}</TD>
                      <TD className="font-medium">{r.brandId ? '✓' : '—'}</TD>
                      <TD className="text-muted">{r.model}</TD>
                      <TD className="text-muted">{r.gradeCode || '—'}</TD>
                      <TD className="text-muted">{r.refPrice || '—'}</TD>
                      <TD className="text-muted">{r.unit || '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {result.rows.length > 30 && <p className="px-3 py-1.5 text-[11.5px] text-faint">仅预览前 30 条（编号列无缩进无关）</p>}
            </div>
            {result.errors.length > 0 && (
              <ul className="rounded-md border border-warn/30 bg-warn-soft/30 px-3 py-2 text-[12px] text-warn">
                {result.errors.slice(0, 6).map((e, i) => <li key={i}>第 {e.line} 行：{e.message}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}