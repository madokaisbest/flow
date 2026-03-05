export function keys<T extends object>(o: T) {
  return Object.keys(o) as (keyof T)[]
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function last<T>(array: T[]) {
  return array[array.length - 1]
}

export function group<T>(array: T[], getKey: (item: T) => string | number) {
  const o: Record<string, T[]> = {}

  array.forEach((item) => {
    const key = getKey(item)
    o[key] = [...(o[key] ?? []), item]
  })

  return o
}

export function copy(text: string) {
  return navigator.clipboard.writeText(text)
}

export function parseFilename(filename: string) {
  let title = filename.replace(/\.epub$/i, '')
  let author = ''
  const match = title.match(/^\[(.*?)\]\s*(.*)$/)
  if (match) {
    author = match[1]!
    title = match[2]!.trim()
  }
  return { title, author }
}


export function pLimit(concurrency: number) {
  const queue: (() => void)[] = []
  let activeCount = 0

  const next = () => {
    activeCount--
    if (queue.length > 0) {
      queue.shift()?.()
    }
  }

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (activeCount >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }
    activeCount++
    try {
      return await fn()
    } finally {
      next()
    }
  }
}

export function generateBookCover(title: string, author?: string): string {
  const styles = [
    { upper: '#A3B18A', lower: '#588157', text: '#FEFAE0' },
    { upper: '#E9C46A', lower: '#F4A261', text: '#264653' },
    { upper: '#457B9D', lower: '#1D3557', text: '#F1FAEE' },
    { upper: '#D4A373', lower: '#FAEDCD', text: '#1F1F1F' },
    { upper: '#CED4DA', lower: '#6C757D', text: '#212529' },
    { upper: '#F8F9FA', lower: '#E9ECEF', text: '#495057' },
  ]

  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const style = styles[hash % styles.length]!

  const width = 1200
  const height = 1600
  const splitY = 1040

  const maxCharsPerLine = 8
  const lines: string[] = []
  for (let i = 0; i < title.length; i += maxCharsPerLine) {
    lines.push(title.slice(i, i + maxCharsPerLine))
  }

  const fontSize = lines.length > 2 ? 100 : 140
  const lineHeight = fontSize * 1.5
  const startY = 400 - ((lines.length - 1) * lineHeight) / 2

  const escapeHtml = (unsafe: string) => unsafe.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m))

  const textElements = lines.map((line, index) => {
    return `<text x="50%" y="${startY + index * lineHeight}" fill="${style.text}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', Ubuntu, Cantarell, 'Helvetica Neue', sans-serif" font-size="${fontSize}" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${escapeHtml(line)}</text>`
  }).join('')

  const authorText = escapeHtml(author || 'Unknown')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${style.upper}"/>
    <rect y="${splitY}" width="${width}" height="${height - splitY}" fill="${style.lower}"/>
    ${textElements}
    <text x="${width - 120}" y="${height - 120}" fill="${style.text}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', Ubuntu, Cantarell, 'Helvetica Neue', sans-serif" font-size="80" text-anchor="end">${authorText}</text>
  </svg>`

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

