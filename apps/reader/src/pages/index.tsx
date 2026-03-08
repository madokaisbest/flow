import { useBoolean } from '@literal-ui/hooks'
import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect, useState, useRef } from 'react'
import {
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdCheckCircle,
  MdOutlineFileDownload,
  MdOutlineShare,
} from 'react-icons/md'
import { useSet } from 'react-use'
import { usePrevious } from 'react-use'

import { ReaderGridView, Button, TextField, DropZone } from '../components'
import { BookRecord, CoverRecord, db } from '../db'
import { addFile, fetchBook, handleFiles } from '../file'
import {
  useDisablePinchZooming,
  useLibrary,
  useMobile,
  useRemoteBooks,
  useRemoteFiles,
  useTranslation,
} from '../hooks'
import { reader, useReaderSnapshot } from '../models'
import { lock } from '../styles'
import { proxyRequest, pack, uploadData } from '../sync'
import { copy, pLimit, generateBookCover, parseFilename } from '../utils'
import { v4 as uuidv4 } from 'uuid'

const placeholder = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="gray" fill-opacity="0" width="1" height="1"/></svg>`

const SOURCE = 'src'

export default function Index() {
  const { focusedTab } = useReaderSnapshot()
  const router = useRouter()
  const src = new URL(window.location.href).searchParams.get(SOURCE)
  const [loading, setLoading] = useState(!!src)

  useDisablePinchZooming()

  useEffect(() => {
    let src = router.query[SOURCE]
    if (!src) return
    if (!Array.isArray(src)) src = [src]

    Promise.all(
      src.map((s) =>
        fetchBook(s).then((b) => {
          reader.addTab(b)
        }),
      ),
    ).finally(() => setLoading(false))
  }, [router.query])

  useEffect(() => {
    if ('launchQueue' in window && 'LaunchParams' in window) {
      window.launchQueue.setConsumer((params) => {
        console.log('launchQueue', params)
        if (params.files.length) {
          Promise.all(params.files.map((f) => f.getFile()))
            .then((files) => handleFiles(files))
            .then((books) => books.forEach((b) => reader.addTab(b)))
        }
      })
    }
  }, [])

  useEffect(() => {
    router.beforePopState(({ url }) => {
      if (url === '/') {
        reader.clear()
      }
      return true
    })
  }, [router])

  return (
    <>
      <Head>
        {/* https://github.com/microsoft/vscode/blob/36fdf6b697cba431beb6e391b5a8c5f3606975a1/src/vs/code/browser/workbench/workbench.html#L16 */}
        {/* Disable pinch zooming */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no"
        />
        <title>{focusedTab?.title ?? 'Flow'}</title>
      </Head>
      <ReaderGridView />
      {loading || <Library />}
    </>
  )
}

const Library: React.FC = () => {
  const books = useLibrary()
  const covers = useLiveQuery(() => db?.covers.toArray() ?? [])
  const t = useTranslation('home')

  const { data: remoteBooks, mutate: mutateRemoteBooks } = useRemoteBooks()
  const { data: remoteFiles, mutate: mutateRemoteFiles } = useRemoteFiles()
  const previousRemoteBooks = usePrevious(remoteBooks)
  const previousRemoteFiles = usePrevious(remoteFiles)

  const [select, toggleSelect] = useBoolean(false)
  const [selectedBookIds, { add, has, toggle, reset }] = useSet<string>()

  const [loading, setLoading] = useState<string | undefined>()
  const loadingRef = useRef<boolean>(false)
  const [readyToSync, setReadyToSync] = useState(false)
  const [filterText, setFilterText] = useState('')

  const { groups } = useReaderSnapshot()

  useEffect(() => {
    if (previousRemoteFiles && remoteFiles) {
      // to remove effect dependency `books`
      db?.books.toArray().then((books) => {
        if (books.length === 0) return

        const newRemoteBooks = remoteFiles.map((f) =>
          books.find((b) => b.name === f.name),
        ) as BookRecord[]

        uploadData(newRemoteBooks)
        mutateRemoteBooks(newRemoteBooks, { revalidate: false })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutateRemoteBooks, remoteFiles])

  useEffect(() => {
    if (!previousRemoteBooks && remoteBooks) {
      const validBooks = Array.isArray(remoteBooks) ? remoteBooks.filter((b: any) => b && b.id) : []
      if (validBooks.length > 0) {
        db?.books.toArray().then((localBooks) => {
          const mergedBooks = validBooks.map((rb: any) => {
            const lb = localBooks.find((l) => l.id === rb.id)
            if (lb) {
              const latestUpdatedAt = Math.max(rb.updatedAt || 0, lb.updatedAt || 0)
              const result = { ...lb, ...rb, updatedAt: latestUpdatedAt || lb.updatedAt || rb.updatedAt }
              if (lb.status === 'local') {
                result.status = 'local'
              }
              return result
            }
            if (!rb.updatedAt) {
              rb.updatedAt = rb.createdAt || Date.now()
            }
            return rb
          })
          return db?.books.bulkPut(mergedBooks)
        }).then(() => setReadyToSync(true)).catch(console.error)
      } else {
        setReadyToSync(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteBooks])

  useEffect(() => {
    if (!remoteFiles || !readyToSync) return

    db?.books.toArray().then(async (books) => {
      const limit = pLimit(3) // 限制并发数为 3

      await Promise.all(remoteFiles.map(remoteFile => limit(async () => {
        if (!remoteFile.name.endsWith('.epub')) return

        let book = books.find((b) => b.name === remoteFile.name)
        if (!book) {
          const { title, author } = parseFilename(remoteFile.name)
          const bookId = uuidv4()
          book = {
            id: bookId,
            name: remoteFile.name,
            size: remoteFile.size || 0,
            status: 'remote',
            remotePath: `/books/${remoteFile.name}`,
            metadata: { title, creator: author },
            createdAt: new Date(remoteFile.lastmod).getTime() || Date.now(),
            updatedAt: new Date(remoteFile.lastmod).getTime() || Date.now(),
            definitions: [],
            annotations: [],
          } as any as BookRecord

          await db?.books.add(book)

          setLoading(bookId)
          try {
            const { title, author } = parseFilename(book.name)
            const coverDataUrl = generateBookCover(book.metadata?.title || title, book.metadata?.creator || author)
            if (coverDataUrl) {
              await db?.covers.add({ id: bookId, cover: coverDataUrl })
            }
          } catch (e) { console.error('generate cover error', e) }
          setLoading(undefined)
        } else {
          const file = await db?.files.get(book.id)
          if (!file) {
            if (book.status !== 'remote') {
              book.status = 'remote'
              book.remotePath = `/books/${remoteFile.name}`
              await db?.books.put(book)
            }
            const cover = await db?.covers.get(book.id)
            if (!cover?.cover) {
              setLoading(book.id)
              const { title, author } = parseFilename(book.name)
              const coverDataUrl = generateBookCover(book.metadata?.title || title, book.metadata?.creator || author)
              if (coverDataUrl) {
                await db?.covers.put({ id: book.id, cover: coverDataUrl })
              }
              setLoading(undefined)
            }
          } else {
            if (book.status === 'remote') {
              book.status = 'local'
              await db?.books.put(book)
            }
          }
        }
      })))
    })
  }, [readyToSync, remoteFiles])

  useEffect(() => {
    if (!select) reset()
  }, [reset, select])

  if (groups.length) return null
  if (!books) return null

  const selectedBooks = [...selectedBookIds].map(
    (id) => books.find((b) => b.id === id)!,
  )

  const displayedBooks = filterText
    ? books.filter(b =>
      b.name.toLowerCase().includes(filterText.toLowerCase()) ||
      b.metadata?.title?.toLowerCase().includes(filterText.toLowerCase()) ||
      b.metadata?.creator?.toLowerCase().includes(filterText.toLowerCase())
    )
    : books

  const allSelected = selectedBookIds.size === displayedBooks.length

  return (
    <DropZone
      className="scroll-parent h-full p-4"
      onDrop={(e) => {
        const bookId = e.dataTransfer.getData('text/plain')
        const book = books.find((b) => b.id === bookId)
        if (book) reader.addTab(book)

        handleFiles(e.dataTransfer.files)
      }}
    >
      <div className="mb-4 space-y-2.5">
        <div>
          <TextField
            name={SOURCE}
            placeholder="https://link.to/remote.epub / Search..."
            type="text"
            value={filterText}
            onChange={(e: any) => setFilterText(e.target.value)}
            hideLabel
            actions={[
              {
                title: t('share'),
                Icon: MdOutlineShare,
                onClick(el) {
                  if (el?.reportValidity()) {
                    copy(`${window.location.origin}/?${SOURCE}=${el.value}`)
                  }
                },
              },
              {
                title: t('download'),
                Icon: MdOutlineFileDownload,
                onClick(el) {
                  if (el?.value && el.value.startsWith('http')) {
                    fetchBook(el.value)
                  } else {
                    el?.reportValidity()
                  }
                },
              },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {books.length ? (
              <Button variant="secondary" onClick={toggleSelect}>
                {t(select ? 'cancel' : 'select')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={!books}
                onClick={() => {
                  fetchBook(
                    'https://epubtest.org/books/Fundamental-Accessibility-Tests-Basic-Functionality-v1.0.0.epub',
                  )
                }}
              >
                {t('download_sample_book')}
              </Button>
            )}
            {select &&
              (allSelected ? (
                <Button variant="secondary" onClick={reset}>
                  {t('deselect_all')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => displayedBooks.forEach((b) => add(b.id))}
                >
                  {t('select_all')}
                </Button>
              ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {select ? (
              <>
                <Button
                  onClick={async () => {
                    toggleSelect()

                    for (const book of selectedBooks) {
                      const remoteFile = remoteFiles?.find(
                        (f) => f.name === book.name,
                      )
                      if (remoteFile) continue

                      const file = await db?.files.get(book.id)
                      if (!file) continue

                      setLoading(book.id)
                      try {
                        try {
                          await proxyRequest('createDirectory', { path: '/books' })
                        } catch { }

                        const reader = new FileReader()
                        const base64Promise = new Promise<string>((resolve) => {
                          reader.onload = () => {
                            const result = reader.result as string
                            if (result && result.includes(',')) {
                              // @ts-ignore
                              resolve(result.split(',')[1])
                            } else {
                              resolve(result || '')
                            }
                          }
                        })
                        reader.readAsDataURL(file.file)
                        const body = await base64Promise

                        await proxyRequest('putFileContents', {
                          path: `/books/${book.name}`,
                          body,
                        })
                      } catch (err) {
                        console.error('Upload failed:', err)
                      } finally {
                        setLoading(undefined)
                      }

                      mutateRemoteFiles()
                    }
                  }}
                >
                  {t('upload')}
                </Button>
                <Button
                  onClick={async () => {
                    toggleSelect()

                    for (const book of selectedBooks) {
                      if (book.status !== 'remote') continue

                      setLoading(book.id)
                      try {
                        const contents = await proxyRequest('getFileContents', {
                          path: `/books/${book.name}`,
                          format: 'binary',
                        })
                        await addFile(book.id, new File([contents as ArrayBuffer], book.name))
                        book.status = 'local'
                        await db?.books.put(book)
                      } catch (err) {
                        console.error('Download failed:', err)
                      } finally {
                        setLoading(undefined)
                      }
                    }
                  }}
                >
                  {t('download')}
                </Button>
                <Button
                  onClick={async () => {
                    toggleSelect()
                    const bookIds = [...selectedBookIds]

                    db?.books.bulkDelete(bookIds)
                    db?.covers.bulkDelete(bookIds)
                    db?.files.bulkDelete(bookIds)

                    // folder data is not updated after `filesDeleteBatch`
                    mutateRemoteFiles(
                      async (data) => {
                        for (const b of selectedBooks) {
                          try {
                            await proxyRequest('deleteFile', { path: `/books/${b.name}` })
                          } catch { }
                        }
                        return data?.filter(
                          (f) => !selectedBooks.find((b) => b.name === f.name),
                        )
                      },
                      { revalidate: false },
                    )
                  }}
                >
                  {t('delete')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  disabled={!books.length}
                  onClick={pack}
                >
                  {t('export')}
                </Button>
                <Button className="relative">
                  <input
                    type="file"
                    accept="application/epub+zip,application/epub,application/zip"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e) => {
                      const files = e.target.files
                      if (files) handleFiles(files)
                    }}
                    multiple
                  />
                  {t('import')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="scroll h-full">
        <ul
          className="grid"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(calc(80px + 3vw), 1fr))`,
            columnGap: lock(16, 32),
            rowGap: lock(24, 40),
          }}
        >
          {displayedBooks.map((book) => (
            <Book
              key={book.id}
              book={book}
              covers={covers}
              select={select}
              selected={has(book.id)}
              loading={loading === book.id}
              toggle={toggle}
              onOpen={async (bookToOpen, onReady) => {
                if (loadingRef.current) return
                loadingRef.current = true
                setLoading(bookToOpen.id)
                try {
                  // Update updatedAt to keep sorting
                  bookToOpen.updatedAt = Date.now()
                  await db?.books.put(bookToOpen)

                  // 1. Sync the latest remote metadata/progress first
                  const latestRemoteBooks = await mutateRemoteBooks(undefined, { revalidate: true })
                  const remoteData = latestRemoteBooks?.find(b => b && b.name === bookToOpen.name)
                  if (remoteData) {
                    bookToOpen.cfi = remoteData.cfi
                    bookToOpen.percentage = remoteData.percentage
                    bookToOpen.annotations = remoteData.annotations || []
                    bookToOpen.definitions = remoteData.definitions || []
                    if (remoteData.configuration) bookToOpen.configuration = remoteData.configuration
                    
                    // Keep the latest updatedAt
                    bookToOpen.updatedAt = Math.max(bookToOpen.updatedAt || 0, remoteData.updatedAt || 0)
                    await db?.books.put(bookToOpen)
                    
                    // Sync back to remote if local is newer (or just to be safe)
                    db?.books.toArray().then(books => uploadData(books)).catch(() => {})
                  }

                  // 2. Download the epub if the status is remote
                  if (bookToOpen.status === 'remote') {
                    const contents = await proxyRequest('getFileContents', {
                      path: `/books/${bookToOpen.name}`,
                      format: 'binary',
                    })
                    await addFile(bookToOpen.id, new File([contents as ArrayBuffer], bookToOpen.name))
                    bookToOpen.status = 'local'
                    await db?.books.put(bookToOpen)
                  }

                  // 3. Open the book with epubjs
                  await onReady(bookToOpen)
                } catch (e) {
                  console.error(e)
                } finally {
                  setLoading(undefined)
                  loadingRef.current = false
                }
              }}
            />
          ))}
        </ul>
      </div>
    </DropZone>
  )
}

interface BookProps {
  book: BookRecord
  covers?: CoverRecord[]
  select?: boolean
  selected?: boolean
  loading?: boolean
  toggle: (id: string) => void
  onOpen?: (book: BookRecord, onReady: (b: BookRecord) => void) => Promise<void>
}
const Book: React.FC<BookProps> = ({
  book,
  covers,
  select,
  selected,
  loading,
  toggle,
  onOpen,
}) => {
  const remoteFiles = useRemoteFiles()

  const router = useRouter()
  const mobile = useMobile()

  const cover = covers?.find((c) => c.id === book.id)?.cover
  const remoteFile = remoteFiles.data?.find((f) => f.name === book.name)

  const Icon = selected ? MdCheckBox : MdCheckBoxOutlineBlank

  return (
    <div className="relative flex flex-col">
      <div
        role="button"
        className="border-inverse-on-surface relative border"
        onClick={async () => {
          if (select) {
            toggle(book.id)
          } else if (onOpen) {
            await onOpen(book, async (updatedBook) => {
              if (mobile) await router.push('/_')
              reader.addTab(updatedBook)
            })
          } else {
            if (mobile) await router.push('/_')
            reader.addTab(book)
          }
        }}
      >
        <div
          className={clsx(
            'absolute bottom-0 h-1 bg-blue-500',
            loading && 'progress-bit w-[5%]',
          )}
        />
        {book.percentage !== undefined && (
          <div className="typescale-body-large absolute right-0 bg-gray-500/60 px-2 text-gray-100">
            {(book.percentage * 100).toFixed()}%
          </div>
        )}
        <img
          src={cover ?? placeholder}
          alt="Cover"
          className="mx-auto aspect-[9/12] object-cover"
          draggable={false}
        />
        {book.status === 'remote' && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <MdOutlineFileDownload className="text-white drop-shadow-lg" size={48} />
          </div>
        )}
        {select && (
          <div className="absolute bottom-1 right-1">
            <Icon
              size={24}
              className={clsx(
                '-m-1',
                selected ? 'text-tertiary' : 'text-outline',
              )}
            />
          </div>
        )}
      </div>

      <div
        className="line-clamp-3 text-on-surface-variant typescale-body-small lg:typescale-body-medium mt-2 w-full"
        title={book.name}
      >
        <MdCheckCircle
          className={clsx(
            'mr-1 mb-0.5 inline',
            remoteFile ? 'text-tertiary' : 'text-surface-variant',
          )}
          size={16}
        />
        {book.name}
      </div>
    </div>
  )
}
