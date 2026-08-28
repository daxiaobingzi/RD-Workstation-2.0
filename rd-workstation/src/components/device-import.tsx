import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ClipboardPaste, FileSpreadsheet, Download, UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react'
import { DeviceService } from '../domain/services'
import type { ProductFamily, Brand } from '../domain/types'
import { Modal } from './ui/dialog'
import { Button } from './ui/button'
import { Textarea, Field } from './ui/field'
import { Segmented } from './ui/segmented'
import { Table, THead, TBody, TR, TH, TD } from './ui/table'
import { toast } from './ui/toast'

interface ImportRow {
  familyId?: string
  familyName?: string
  model: string
  brandId?: string
  spec?: string
  gradeCode?: string
  unit?: string
  params?: Record<string, unknown>
}

const GRADE_ALIAS: Record<string, string> = { 经济: 'economic', 经济型: 'economic', 标准: 'standard', 标准型: 'standard', 高端: 'premium', 高端型: 'premium' }

function parseMatrix(rows: (string | number)[][], families: ProductFamily[], brands: Brand[]): { rows: ImportRow[]; errors: { line: number; message: string }[] } {
  const famByName = new Map(families.map((f) => [f.name, f]))
  const famByCode = new Map(families.map((f) => [f.code, f]))
  const famById = new Map(families.map((f) => [f.id, f]))
  const brandByName = new Map(brands.map((b) => [b.name, b]))
  const matchFam = (s: string) => famByName.get(s) ?? famByCode.get(s) ?? famById.get(s)
  const matchBrand = (s: string) => brandByName.get(s)
  const grade = (s: string) => GRADE_ALIAS[s] ?? s

  // 表头识别（可选）
  const headerMap: Record<string, number> = { 产品族: 0, 型号: 1, 品牌: 2, 规格: 3, 档次: 4, 单位: 5, 参数: 6 }
  const first = (rows[0] ?? []).map((c) => String(c).trim())
  const hasHeader = first.some((h) => Object.keys(headerMap).some((k) => h.includes(k)))
  const src = hasHeader ? rows.slice(1) : rows

  const out: ImportRow[] = []
  const errors: { line: number; message: string }[] = []
  src.forEach((raw, idx) => {
    const line = (hasHeader ? 2 : 1) + idx
    const cell = (i: number) => String(raw[i] ?? '').trim()
    const model = cell(1)
    if (!model) { errors.push({ line, message: '缺少型号名称，已跳过' }); return }
    const famRaw = cell(0)
    const fam = famRaw ? matchFam(famRaw) : undefined
    if (famRaw && !fam) { errors.push({ line, message: `产品族「${famRaw}」不存在，已跳过` }); return }
    const brandRaw = cell(2)
    const brand = brandRaw ? matchBrand(brandRaw) : undefined
    const params: Record<string, unknown> = {}
    if (cell(6)) {
      cell(6).split(/[;；]/).forEach((pair) => {
        const [k, v] = pair.split('=')
        if (k?.trim()) params[k.trim()] = (v ?? '').trim() || true
      })
    }
    out.push({
      familyId: fam?.id,
      familyName: famRaw || fam?.name,
      model,
      brandId: brand?.id,
      spec: cell(3) || undefined,
      gradeCode: cell(4) ? grade(cell(4)) : undefined,
      unit: cell(5) || undefined,
      params,
    })
  })
  return { rows: out, errors }
}

/** 设备型号批量导入：按「产品族,型号,品牌,规格,档次,单位,参数」解析并批量新增 */
export function DeviceImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'paste' | 'file'>('paste')
  const [text, setText] = useState('产品族,型号,品牌,规格,档次,单位,参数\nNVR,NVR-32路,海康威视,32路 NVR,标准,台,路数=32\n摄像机,4K枪机,海康威视,4MP 星光,高端,台,镜头=2.8mm')
  const [result, setResult] = useState<{ rows: ImportRow[]; errors: { line: number; message: string }[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const families = DeviceService.families()
  const brands = DeviceService.brands()

  const parseText = () => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const matrix = lines.map((l) => {
      const s = l.includes('\t') ? '\t' : l.includes('，') ? '，' : l.includes('；') ? '；' : l.includes(';') ? ';' : ','
      return l.split(s).map((c) => c.trim())
    })
    setResult(parseMatrix(matrix, families, brands))
  }

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }).map((r) => r.map((c) => String(c)))
      setResult(parseMatrix(matrix as (string | number)[][], families, brands))
    } catch {
      toast('文件解析失败，请使用 CSV 或 Excel', 'error')
    }
  }

  const importAll = () => {
    if (!result) return
    const done = result.rows.filter((r) => r.familyId)
    let ok = 0
    const unbound: string[] = []
    for (const r of done) {
      const created = DeviceService.addModel({
        product_family_id: r.familyId!, model: r.model, specification: r.spec, unit: r.unit, grade_code: r.gradeCode, status: 'active', parameter_json: r.params, brand_id: r.brandId,
      })
      if (created) ok++
    }
    // 无法归族的行单独列出
    result.rows.filter((r) => !r.familyId).forEach((r) => unbound.push(r.model))
    toast(`成功导入 ${ok} 个型号${unbound.length ? `，${unbound.length} 个无法归族未导入` : ''}${result.errors.length ? `，跳过 ${result.errors.length} 条问题行` : ''}`)
    setResult(null)
    if (!unbound.length) onClose()
  }

  const downloadTpl = () => {
    const blob = new Blob(['\uFEFF产品族,型号,品牌,规格,档次,单位,参数\nNVR,NVR-32路,海康威视,32路 NVR,标准,台,路数=32'], { type: 'text/csv;charset=utf-8' })
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
          <Field label="表头：产品族, 型号, 品牌, 规格, 档次, 单位, 参数（参数用 键=值; 分隔）">
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
          <Button size="sm" disabled={!result?.rows.filter((r) => r.familyId).length} onClick={importAll}>
            <UploadCloud className="size-3.5" />批量导入{result ? `（${result.rows.filter((r) => r.familyId).length}）` : ''}
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
                <THead><TR><TH>产品族</TH><TH>型号</TH><TH>品牌</TH><TH>规格</TH><TH>档次</TH><TH>单位</TH><TH>参数</TH></TR></THead>
                <TBody>
                  {result.rows.slice(0, 30).map((r, i) => (
                    <TR key={i}>
                      <TD className={r.familyId ? '' : 'text-warn'}>{r.familyName || '未匹配'}</TD>
                      <TD className="font-medium">{r.model}</TD>
                      <TD className="text-muted">{r.brandId ? '✓' : '—'}</TD>
                      <TD className="max-w-[180px] truncate text-muted">{r.spec || '—'}</TD>
                      <TD className="text-muted">{r.gradeCode || '—'}</TD>
                      <TD className="text-muted">{r.unit || '—'}</TD>
                      <TD className="max-w-[160px] truncate text-muted">{Object.keys(r.params ?? {}).length ? Object.entries(r.params!).map(([k, v]) => `${k}=${String(v)}`).join(';') : '—'}</TD>
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