import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db'
import { useSettings } from '../state'

export function useLibrary() {
  const [settings] = useSettings()

  return useLiveQuery(() => {
    if (!db) return []
    const field = settings.librarySortField || 'createdAt'
    const order = settings.librarySortOrder || 'desc'

    let collection = db.books.orderBy(field)
    if (order === 'desc') {
      collection = collection.reverse()
    }
    return collection.toArray()
  }, [settings.librarySortField, settings.librarySortOrder])
}
