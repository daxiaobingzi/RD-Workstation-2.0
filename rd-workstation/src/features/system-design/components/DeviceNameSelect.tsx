import { useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, Clock, Check } from 'lucide-react'
import type { ProductOption } from '../../../services/device.catalog'
import { cn } from '../../../lib/utils'

/**
 * 设备名称选择器：模糊搜索（产品名/族名/品牌/型号）+ 最近使用 分组
 * 点位录入的"设备名称"必须来自设备中心，不允许自由文本。
 */
export function DeviceNameSelect({
  value,
  onChange,
  options,
  recentIds = [],
  placeholder = '输入关键字搜索设备…',
  size = 'md',
}: {
  value?: string
  onChange: (deviceId: string) => void
  options: ProductOption[]
  recentIds?: string[]
  placeholder?: string
  size?: 'md' | 'sm'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find((o) => o.id === value)

  /** 最近使用列表（仅保留仍存在的设备） */
  const recent = useMemo(() => {
    const byId = new Map(options.map((o) => [o.id, o]))
    return recentIds.map((id) => byId.get(id)).filter((o): o is ProductOption => Boolean(o))
  }, [recentIds, options])

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase()
    if (!kw) return options
    return options.filter((o) => o.searchText.toLowerCase().includes(kw))
  }, [query, options])

  const total = filtered.length
  const groups: { label?: string; items: ProductOption[] }[] = []
  if (!query.trim()) {
    if (recent.length) groups.push({ label: '最近使用', items: recent })
    groups.push({ label: '全部设备', items: filtered })
  } else {
    groups.push({ items: filtered })
  }

  const pick = (o: ProductOption) => {
    onChange(o.id)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, total - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const flat = groups.flatMap((g) => g.items)
      if (flat[active]) pick(flat[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // 打开时重置激活项并聚焦输入
  const openMenu = () => {
    setOpen(true)
    setActive(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'flex w-full cursor-text items-center gap-1.5 rounded-[6px] border border-rule bg-surface text-[13px] transition-colors',
          'focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30',
          size === 'md' ? 'h-8 px-2.5' : 'h-7 px-2 text-[12.5px]',
        )}
        onClick={openMenu}
      >
        <Search className="size-3.5 shrink-0 text-faint" />
        {selected ? (
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-ink">{selected.name}</span>
            {selected.brandNames.length > 0 && <span className="text-muted"> · {selected.brandNames.join('/')}</span>}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-faint">{placeholder}</span>
        )}
        <ChevronDown className="size-3.5 shrink-0 text-faint" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onFocus={openMenu}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="absolute inset-0 cursor-text opacity-0"
          aria-label="搜索设备"
        />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-rule bg-surface shadow-lg">
          {total === 0 && <p className="px-3 py-4 text-center text-[12px] text-faint">未找到匹配设备</p>}
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && (
                <p className="flex items-center gap-1.5 border-b border-rule bg-surface-subtle/50 px-2.5 py-1 text-[10.5px] font-semibold tracking-wide text-faint uppercase">
                  <Clock className="size-3" />{g.label}
                </p>
              )}
              {g.items.map((o, i) => {
                const idx = groups.slice(0, gi).reduce((s, x) => s + x.items.length, 0) + i
                return (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o)}
                    onMouseEnter={() => setActive(idx)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12.5px]',
                      idx === active ? 'bg-accent-soft text-accent' : 'text-ink',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{o.name}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {[o.familyName, o.categoryName, o.brandNames.join('/'), o.modelNames.slice(0, 2).join(', ')].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    {o.id === value && <Check className="size-3.5 shrink-0" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}