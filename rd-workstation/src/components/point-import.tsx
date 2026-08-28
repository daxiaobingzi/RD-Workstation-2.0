import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ClipboardPaste, FileSpreadsheet, Download, UploadCloud, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { parsePointRows, PointService, type ImportPointRow } from '../domain/services'
import type { PointCategory } from '../domain/types'
import { Modal } from './ui/dialog'
import { Button } from './ui/button'
import { Textarea, Field } from './ui/field'
import { Segmented } from './ui/segmented'
import { Table, THead, TBody, TR, TH, TD, NumCell } from './ui/table'
import { toast } from './ui/toast'
import { fmtNum, cn } from '../lib/utils'

/** 点位批量导入：粘贴 CSV/TSV 或上传 Excel。解析 → 预览校验 → 写入。 */
export function PointImportDialog({
  open,
  onClose,
  psId,
  categories,
  onImported,
}: {
  open: boolean
  onClose: () => void
  psId: string
  categories: PointCategory[]
  onImported: (count: number) => void
}) {
  const [mode, setMode] = useState<'paste' | 'file'>('paste')
  const [text, setText] = useState(PointService.importTemplate)
  const [rows, setRows] = useState<{ parsed: ImportPointRow[]; errors: { line: number; message: string }[]; source: string } | null>(null)
  const [imported, setImported] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseText = () => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const matrix = lines.map((l) => {
      const hasTab = l.includes('\t')
      const hasComma = l.includes(',')
      const hasSemi = l.includes('；') || l.includes(';')
      const sep = hasTab ? '\t' : hasSemi ? /[;；]/ : hasComma ? ',' : null
      return sep === null ? [l] : l.split(sep).map((c) => c.trim())
    })
    const r = parsePointRows(matrix, categories)
    setRows({ parsed: r.rows, errors: r.errors, source: 'paste' })
    setImported(false)
  }

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }).map((r) => r.map((c) => String(c)))
      const r = parsePointRows(matrix as (string | number)[][], categories)
      setRows({ parsed: r.rows, errors: r.errors, source: file.name })
      setImported(false)
    } catch {
      toast('文件解析失败，请使用 CSV 或 Excel（xlsx/xls）', 'error')
    }
  }

  const doImport = () => {
    if (!rows || !rows.parsed.length) return
    const created = PointService.addMany(psId, rows.parsed)
    setImported(true)
    onImported(created.length)
    toast(`成功导入 ${created.length} 条点位${rows.errors.length ? `，跳过 ${rows.errors.length} 条问题行` : ''}`)
    setRows(null)
  }

  const totalQty = rows ? rows.parsed.reduce((s, r) => s + r.quantity, 0) : 0
  const catName = (id?: string, raw?: string) => categories.find((c) => c.id === id)?.name ?? raw ?? '未分类'

  const downloadTemplate = () => {
    const blob = new Blob(['\uFEFF' + PointService.importTemplate()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '点位导入模板.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal open={open} onClose={onClose} title="点位批量导入" width={760}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Segmented
            options={[
              { value: 'paste', label: '粘贴 CSV / 表格' },
              { value: 'file', label: '上传 Excel' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Button size="sm" variant="outline" onClick={downloadTemplate}>
            <Download className="size-3.5" />下载模板
          </Button>
        </div>

        {mode === 'paste' ? (
          <Field label="粘贴内容（表头：点位名称,类别,楼层,位置,数量,备注；支持 Tab/分号分隔）">
            <Textarea
              className="h-44 font-mono text-[12px]"
              value={text}
              onChange={(e) => { setText(e.target.value); setRows(null); setImported(false) }}
              placeholder={'大厅高清枪机,室内摄像机,1F,大堂,12\n走廊半球,室内摄像机,2F,走廊,8'}
            />
          </Field>
        ) : (
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-rule bg-surface-subtle/40 px-6 py-10 transition-colors hover:border-accent/50 hover:bg-accent-soft/20"
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="size-7 text-accent2" />
            <p className="text-[13px] font-medium">点击选择 Excel / CSV 文件</p>
            <p className="text-[11.5px] text-faint">读取第一个工作表，首行可为表头</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = '' }}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          {mode === 'paste' && (
            <Button size="sm" variant="outline" onClick={parseText}>
              <ClipboardPaste className="size-3.5" />解析预览
            </Button>
          )}
          <Button size="sm" disabled={!rows?.parsed.length || imported} onClick={doImport}>
            <UploadCloud className="size-3.5" />导入 {rows?.parsed.length ? `（${rows.parsed.length} 条）` : ''}
          </Button>
        </div>

        {rows && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              <CheckCircle2 className="size-3.5 text-ok" />
              解析成功 {rows.parsed.length} 条 · 合计 {fmtNum(totalQty)} 台 · 来源：{rows.source}
              {rows.errors.length > 0 && (
                <span className="flex items-center gap-1 text-warn">
                  <AlertTriangle className="size-3.5" />{rows.errors.length} 条问题行
                </span>
              )}
            </p>
            <div className="max-h-56 overflow-auto rounded-md border border-rule">
              <Table>
                <THead><TR><TH>名称</TH><TH>类别</TH><TH>楼层</TH><TH>位置</TH><TH>数量</TH></TR></THead>
                <TBody>
                  {rows.parsed.slice(0, 50).map((r, i) => (
                    <TR key={i}>
                      <TD className="font-medium">{r.point_name}</TD>
                      <TD className={cn('text-muted', !r.category_id && 'text-warn')}>{catName(r.category_id, r.category_name)}</TD>
                      <TD className="text-muted">{r.floor || '—'}</TD>
                      <TD className="text-muted">{r.space || '—'}</TD>
                      <TD><NumCell>{fmtNum(r.quantity)}</NumCell></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {rows.parsed.length > 50 && <p className="px-3 py-1.5 text-[11.5px] text-faint">仅预览前 50 条，其余将一并导入</p>}
            </div>
            {rows.errors.length > 0 && (
              <ul className="rounded-md border border-warn/30 bg-warn-soft/30 px-3 py-2 text-[12px] text-warn">
                {rows.errors.slice(0, 8).map((e, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <XCircle className="mt-0.5 size-3.5 shrink-0" />
                    <span>第 {e.line} 行：{e.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}