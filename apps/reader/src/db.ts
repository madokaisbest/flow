import { IS_SERVER } from '@literal-ui/hooks'
import Dexie, { Table } from 'dexie'

import { PackagingMetadataObject } from '@flow/epubjs/types/packaging'

import { Annotation } from './annotation'
import { TypographyConfiguration } from './state'

export interface FileRecord {
  id: string
  file: File
}

export interface CoverRecord {
  id: string
  cover: string | null
}

export interface BookRecord {
  // TODO: use file hash as id
  id: string
  hash?: string
  name: string
  title?: string
  author?: string
  size: number
  status?: 'local' | 'remote'
  remotePath?: string
  metadata: PackagingMetadataObject
  createdAt: number
  updatedAt?: number
  lastReadAt?: number
  readingTime?: number
  isFavorite?: boolean
  tags?: string[]
  cfi?: string
  percentage?: number
  definitions: string[]
  annotations: Annotation[]
  configuration?: {
    typography?: TypographyConfiguration
  }
}

export class DB extends Dexie {
  // 'books' is added by dexie when declaring the stores()
  // We just tell the typing system this is the case
  files!: Table<FileRecord>
  covers!: Table<CoverRecord>
  books!: Table<BookRecord>

  constructor(name: string) {
    super(name)

    this.version(1).stores({
      books:
        'id, hash, name, title, author, size, status, metadata, createdAt, updatedAt, lastReadAt, isFavorite, *tags, cfi, percentage, definitions, annotations, configuration',
      covers: 'id, cover',
      files: 'id, file',
    })
  }
}

export const db = IS_SERVER ? null : new DB('re-reader')
