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
    return collection.toArray().then((results) => {
      const localFirst = settings.librarySortLocalFirst ?? true
      if (localFirst) {
        const local = results.filter((b) => b.status === 'local' || !b.status)
        const remote = results.filter((b) => b.status === 'remote')
        return [...local, ...remote]
      }
      return results
    })
  }, [settings.librarySortField, settings.librarySortOrder, settings.librarySortLocalFirst])
}
