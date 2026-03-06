import { useCallback, useEffect, useRef } from 'react'
import { useSnapshot } from 'valtio'

import { Annotation } from '@flow/reader/annotation'
import { BookRecord } from '@flow/reader/db'
import { BookTab } from '@flow/reader/models'
import { uploadData } from '@flow/reader/sync'

import { useRemoteBooks } from './useRemote'

export function useSync(tab: BookTab) {
  const { mutate } = useRemoteBooks()
  const { location, book } = useSnapshot(tab)

  const id = tab.book.id

  const changesBufferRef = useRef<Partial<BookRecord>>({})
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const sync = useCallback(
    (changes: Partial<BookRecord>) => {
      Object.assign(changesBufferRef.current, changes)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        const mergedChanges = { ...changesBufferRef.current }
        changesBufferRef.current = {}

        mutate(
          (remoteBooks) => {
            if (remoteBooks) {
              const i = remoteBooks.findIndex((b) => b && b.id === id)
              if (i < 0) return remoteBooks

              remoteBooks[i] = {
                ...remoteBooks[i]!,
                ...mergedChanges,
              }

              uploadData(remoteBooks)

              return [...remoteBooks]
            }
          },
          { revalidate: false },
        )
      }, 3000)
    },
    [id, mutate],
  )

  useEffect(() => {
    sync({
      cfi: location?.start.cfi,
      percentage: book.percentage,
    })
  }, [sync, book.percentage, location?.start.cfi])

  useEffect(() => {
    sync({
      definitions: book.definitions as string[],
    })
  }, [book.definitions, sync])

  useEffect(() => {
    sync({
      annotations: book.annotations as Annotation[],
    })
  }, [book.annotations, sync])

  useEffect(() => {
    sync({
      configuration: book.configuration,
    })
  }, [book.configuration, sync])
}
