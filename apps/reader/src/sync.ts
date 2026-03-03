import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { createClient } from 'webdav'

import { BookRecord, db } from './db'

export const WEB_DAV_CONFIG_KEY = 'webdav-config'

function getWebDAVClient() {
  const configStr = typeof window !== 'undefined' ? window.localStorage.getItem(WEB_DAV_CONFIG_KEY) || '{}' : '{}'
  const config = JSON.parse(configStr)
  if (!config.url || !config.username || !config.password) {
    throw new Error('WebDAV not configured')
  }

  const auth = typeof window !== 'undefined'
    ? btoa(unescape(encodeURIComponent(`${config.username}:${config.password}`)))
    : Buffer.from(`${config.username}:${config.password}`).toString('base64')

  return createClient(config.url, {
    headers: {
      Authorization: `Basic ${auth}`
    }
  })
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
  const client = getWebDAVClient()
  return client.putFileContents(`/${DATA_FILENAME}`, content, { overwrite: true })
}

export const webdavFilesFetcher = async (path: string) => {
  try {
    const client = getWebDAVClient()
    const contents = await client.getDirectoryContents(path)
    return (contents as any[]).map((item) => ({
      ...item,
      name: item.basename,
      '.tag': item.type === 'directory' ? 'folder' : 'file',
    }))
  } catch (e: any) {
    return []
  }
}

export const webdavBooksFetcher = async (path: string) => {
  try {
    const client = getWebDAVClient()
    const text = await client.getFileContents(path, { format: 'text' })
    return deserializeData(text as string)
  } catch (e: any) {
    return []
  }
}

// Helper for raw proxy access in index.tsx
export async function proxyRequest(method: string, params: any) {
  const client = getWebDAVClient() as any

  if (method === 'getFileContents') {
    return client.getFileContents(params.path, { format: params.format })
  } else if (method === 'createDirectory') {
    return client.createDirectory(params.path)
  } else if (method === 'putFileContents') {
    let data: any = params.body
    if (typeof data === 'string' && params.path.endsWith('.epub')) {
      const binaryString = atob(data)
      const len = binaryString.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      data = bytes.buffer
    }
    return client.putFileContents(params.path, data, { overwrite: true })
  } else if (method === 'deleteFile') {
    return client.deleteFile(params.path)
  }
  throw new Error(`Unsupported method: ${method}`)
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
