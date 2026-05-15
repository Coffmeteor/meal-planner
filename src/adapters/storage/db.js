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
  return openDatabase().then((db) => {
    if (!db) {
      return Promise.reject(new Error('IndexedDB not available'))
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, storeMode)
      const store = tx.objectStore(STORE_NAME)
      let result

      try {
        const request = action(store)
        request.onsuccess = () => {
          result = request.result
        }
        request.onerror = () => reject(request.error)
      } catch (error) {
        reject(error)
        return
      }

      // readwrite: resolve only after transaction fully commits to disk.
      // request.onsuccess alone is not enough on iOS Safari.
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(new Error('Transaction aborted'))
    })
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
