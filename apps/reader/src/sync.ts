import { saveAs } from 'file-saver'
import JSZip from 'jszip'

import { BookRecord, db } from './db'

export const WEB_DAV_CONFIG_KEY = 'webdav-config'

async function callProxy(method: string, params: any = {}) {
  const configStr = window.localStorage.getItem(WEB_DAV_CONFIG_KEY) || '{}'
  const config = JSON.parse(configStr)

  const response = await fetch('/api/webdav', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...config, method, ...params }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Proxy request failed')
  }

  // Handle binary format
  if (params.format === 'binary') {
    return response.arrayBuffer()
  }

  return response.json()
}

interface SerializedBooks {
  version: number
  dbVersion: number
  books: BookRecord[]
}

const VERSION = 1
export const DATA_FILENAME = 'data.json'

function serializeData(books?: BookRecord[]) {
  return JSON.stringify({
    version: VERSION,
    dbVersion: db?.verno,
    books,
  })
}

function deserializeData(text: string) {
  const { version, dbVersion, books } = JSON.parse(text) as SerializedBooks
  return books
}

export async function uploadData(books: BookRecord[]) {
  const content = serializeData(books)
  // Robust base64 for unicode strings
  const base64 = typeof window !== 'undefined'
    ? btoa(unescape(encodeURIComponent(content)))
    : Buffer.from(content).toString('base64')
  return callProxy('putFileContents', { path: `/${DATA_FILENAME}`, body: base64 })
}

export const dropboxFilesFetcher = async (path: string) => {
  try {
    const contents = await callProxy('getDirectoryContents', { path })
    if (contents && contents._404) return []
    return (contents as any[]).map((item) => ({
      ...item,
      name: item.basename,
      '.tag': item.type === 'directory' ? 'folder' : 'file',
    }))
  } catch (e: any) {
    return []
  }
}

export const dropboxBooksFetcher = async (path: string) => {
  try {
    const text = await callProxy('getFileContents', { path, format: 'text' })
    if (text && (text._404 || text.error)) return []
    return deserializeData(text as string)
  } catch (e: any) {
    return []
  }
}

// Helper for raw proxy access in index.tsx
export async function proxyRequest(method: string, params: any) {
  return callProxy(method, params)
}

export async function pack() {
  const books = await db?.books.toArray()
  const covers = await db?.covers.toArray()
  const files = await db?.files.toArray()

  const zip = new JSZip()
  zip.file(DATA_FILENAME, serializeData(books))
  zip.file('covers.json', JSON.stringify(covers))

  const folder = zip.folder('files')
  files?.forEach((f) => folder?.file(f.file.name, f.file))

  const date = new Intl.DateTimeFormat('fr-CA').format().replaceAll('-', '')

  return zip.generateAsync({ type: 'blob' }).then((content) => {
    saveAs(content, `flow_backup_${date}.zip`)
  })
}

export async function unpack(file: File) {
  const zip = new JSZip()
  await zip.loadAsync(file)

  const booksJSON = zip.file(DATA_FILENAME)
  const coversJSON = zip.file('covers.json')
  if (!booksJSON || !coversJSON) return

  const books = deserializeData(await booksJSON.async('text'))

  db?.books.bulkPut(books)

  const coversText = await coversJSON.async('text')
  db?.covers.bulkPut(JSON.parse(coversText))

  const folder = zip.folder('files')
  folder?.forEach(async (_, f) => {
    const book = books.find((b) => `books/${b.name}` === f.name)
    if (!book) return

    const data = await f.async('blob')
    const file = new File([data], book.name)
    db?.files.put({ file, id: book.id })
  })
}
