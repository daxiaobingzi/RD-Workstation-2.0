import { useState } from 'react'
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-react'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'

/* ---------- 富文本编辑器（通用参数 / 详细参数）：存 HTML ---------- */
export function RichTextEditor({ value, onChange, height = 140, placeholder }: { value?: string; onChange: (html: string) => void; height?: number; placeholder?: string }) {
  const [editor, setEditor] = useState<IDomEditor | null>(null)

  const toolbarConfig: Partial<IToolbarConfig> = {
    excludeKeys: ['group-video', 'insertVideo', 'uploadVideo', 'group-image', 'insertImage', 'uploadImage', 'group-link', 'todo'],
  }
  const editorConfig: Partial<IEditorConfig> = { placeholder: placeholder ?? '请输入内容…', MENU_CONF: {} }

  return (
    <div className="overflow-hidden rounded-md border border-rule bg-surface">
      <Toolbar editor={editor} defaultConfig={toolbarConfig} mode="default" className="border-b border-rule" />
      <Editor
        defaultConfig={editorConfig}
        value={value ?? ''}
        onCreated={setEditor}
        onChange={(e) => onChange(e.getHtml())}
        mode="default"
        style={{ height, overflowY: 'auto' }}
      />
    </div>
  )
}

/** 把富文本 HTML 转纯文本摘要（用于表格/列表展示） */
export function htmlToText(html?: string, max = 60): string {
  if (!html) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}