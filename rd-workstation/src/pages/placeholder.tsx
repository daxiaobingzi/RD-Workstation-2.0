import { Construction } from 'lucide-react'
import { PageHeader } from '../components/ui/page-header'

export function PlaceholderPage({ label, desc }: { label: string; desc?: string }) {
  return (
    <div className="mx-auto max-w-[1080px] p-5">
      <PageHeader title={label} subtitle={desc ?? '将在后续批次实现'} />
      <div className="mt-8 flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-rule bg-surface/60 text-faint">
        <Construction className="mb-2 size-8" />
        <p className="text-[13px]">「{label}」模块建设中</p>
      </div>
    </div>
  )
}
