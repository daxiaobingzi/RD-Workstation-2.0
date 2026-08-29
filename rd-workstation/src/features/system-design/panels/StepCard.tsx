export function StepCard({ title, desc, extra, children }: { title: string; desc?: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold">{title}</h2>
          {desc && <p className="mt-0.5 text-[12px] text-muted">{desc}</p>}
        </div>
        {extra && <div className="shrink-0">{extra}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}