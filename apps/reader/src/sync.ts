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

declare const DecompressionStream: any;
async function decompress(compressedData: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  writer.write(compressedData as any)
  writer.close()
  return new Uint8Array(await new Response(ds.readable).arrayBuffer())
}

export async function fetchRemoteEpubCover(path: string): Promise<string | null> {
  try {
    const client = getWebDAVClient() as any
    const fileContent = await client.getFileContents(path, { format: 'binary', headers: { Range: 'bytes=0-262143' } }) as ArrayBuffer
    const bytes = new Uint8Array(fileContent as ArrayBuffer)
    let offset = 0

    const files: Record<string, Uint8Array> = {}

    while (offset + 30 <= bytes.length) {
      if (bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x4B || bytes[offset + 2] !== 0x03 || bytes[offset + 3] !== 0x04) break

      const flags = bytes[offset + 6]! | (bytes[offset + 7]! << 8)
      const method = bytes[offset + 8]! | (bytes[offset + 9]! << 8)

      if ((flags & 8) !== 0) break

      const compressedSize = bytes[offset + 18]! | (bytes[offset + 19]! << 8) | (bytes[offset + 20]! << 16) | (bytes[offset + 21]! << 24)
      const filenameLen = bytes[offset + 26]! | (bytes[offset + 27]! << 8)
      const extraLen = bytes[offset + 28]! | (bytes[offset + 29]! << 8)

      const filenameStart = offset + 30
      const filenameEnd = filenameStart + filenameLen
      if (filenameEnd > bytes.length) break
      const name = new TextDecoder().decode(bytes.subarray(filenameStart, filenameEnd))

      const dataStart = filenameEnd + extraLen
      const dataEnd = dataStart + compressedSize
      if (dataEnd > bytes.length) break

      const cData = bytes.subarray(dataStart, dataEnd)
      if (method === 8) {
        try { files[name] = await decompress(cData) } catch (e) { }
      } else if (method === 0) {
        files[name] = cData
      }
      offset = dataEnd
    }

    const containerFile = files['META-INF/container.xml']
    if (!containerFile) return null
    const containerXml = new TextDecoder().decode(containerFile)

    const opfMatch = /<rootfile[^>]+full-path="([^"]+)"/i.exec(containerXml)
    if (!opfMatch || !opfMatch[1]) return null
    const opfPath = opfMatch[1]

    const opfFile = files[opfPath]
    if (!opfFile) return null
    const opfXml = new TextDecoder().decode(opfFile)

    let coverIdMatch = /<meta[^>]+name="cover"[^>]+content="([^"]+)"/i.exec(opfXml)
    if (!coverIdMatch) {
      coverIdMatch = /<meta[^>]+content="([^"]+)"[^>]+name="cover"/i.exec(opfXml)
    }

    let coverHref = null
    if (coverIdMatch) {
      const coverId = coverIdMatch[1]
      let itemMatch = new RegExp(`<item[^>]+id="${coverId}"[^>]+href="([^"]+)"`, 'i').exec(opfXml)
      if (!itemMatch) itemMatch = new RegExp(`<item[^>]+href="([^"]+)"[^>]+id="${coverId}"`, 'i').exec(opfXml)
      if (itemMatch) coverHref = itemMatch[1]
    }

    if (!coverHref) {
      const itemMatch = /<item[^>]+href="([^"]+)"[^>]+properties="cover-image"[^>]*>/i.exec(opfXml)
      if (itemMatch) coverHref = itemMatch[1]
    }

    if (!coverHref) return null

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : ''
    const coverPath = opfDir ? `${opfDir}/${decodeURIComponent(coverHref)}` : decodeURIComponent(coverHref)

    const coverFile = files[coverPath]
    if (!coverFile) return null

    let mime = 'image/jpeg'
    const lowerPath = coverPath.toLowerCase()
    if (lowerPath.endsWith('.png')) mime = 'image/png'
    else if (lowerPath.endsWith('.gif')) mime = 'image/gif'
    else if (lowerPath.endsWith('.webp')) mime = 'image/webp'
    else if (lowerPath.endsWith('.svg')) mime = 'image/svg+xml'

    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < coverFile.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, coverFile.subarray(i, i + chunkSize) as any)
    }
    return `data:${mime};base64,${btoa(binary)}`
  } catch (e) {
    console.warn("Failed to fetch remote cover", e)
    return null
  }
}

