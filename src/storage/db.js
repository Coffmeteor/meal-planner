const DB_NAME = 'meal-planner-local'
const DB_VERSION = 1
const STORE_NAME = 'app'

let dbPromise

export function openDatabase() {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'))
    } catch (error) {
      reject(error)
    }
  }).catch((error) => {
    console.warn('IndexedDB open failed', error)
    dbPromise = null
    return null
  })

  return dbPromise
}

function transaction(storeMode, action) {
  return openDatabase()
    .then(
      (db) =>
        new Promise((resolve, reject) => {
          if (!db) {
            resolve(undefined)
            return
          }

          try {
            const tx = db.transaction(STORE_NAME, storeMode)
            const store = tx.objectStore(STORE_NAME)
            const request = action(store)

            request.onsuccess = () => resolve(request.result)
            request.onerror = () => {
              console.warn('IndexedDB request failed', request.error)
              resolve(undefined)
            }
            // Wait for transaction complete so data is fully committed to disk
            // before resolving. iOS Safari may not flush before onsuccess fires.
            tx.oncomplete = () => {
              /* already resolved by request.onsuccess */
            }
            tx.onerror = () => {
              console.warn('IndexedDB transaction failed', tx.error)
            }
          } catch (error) {
            console.warn('IndexedDB transaction setup failed', error)
            resolve(undefined)
          }
        }),
    )
    .catch((error) => {
      console.warn('IndexedDB operation failed', error)
      return undefined
    })
}

export function get(key) {
  return transaction('readonly', (store) => store.get(key))
}

export function set(key, value) {
  return transaction('readwrite', (store) => store.put(value, key))
}

export function deleteKey(key) {
  return transaction('readwrite', (store) => store.delete(key))
}

export { deleteKey as delete }

export function clear() {
  return transaction('readwrite', (store) => store.clear())
}
