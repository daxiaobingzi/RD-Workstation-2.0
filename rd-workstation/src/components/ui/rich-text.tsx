/** 把富文本 HTML / 纯文本统一转纯文本（用于表单初始化的多行文本域、抽屉预览）。
 *  兼容历史存量 HTML 数据：纯文本原样返回。 */
export function htmlToPlainText(html?: string): string {
  if (!html) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return (tmp.textContent || '').trim()
}

/** 纯文本摘要（用于表格/列表展示） */
export function htmlToText(html?: string, max = 60): string {
  const text = htmlToPlainText(html).replace(/\s+/g, ' ').trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}
