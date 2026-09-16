import { Result } from '@praha/byethrow'

import {
  PROJECT_DB_NAME,
  PROJECT_DB_VERSION,
  PROJECT_DOCUMENTS_STORE,
  PROJECT_MEDIA_STORE,
  PROJECTS_STORE,
} from './project'
import {
  ProjectQuotaError,
  ProjectReadError,
  ProjectStoreOpenError,
  ProjectStoreUnsupportedError,
  ProjectWriteError,
} from './errors'

export type IDBFactoryLike = {
  open: (name: string, version?: number) => IDBOpenDBRequest
}

export const resolveIdbFactory = (
  factory?: IDBFactoryLike,
): Result.Result<IDBFactoryLike, ProjectStoreUnsupportedError> => {
  if (factory !== undefined) {
    return Result.succeed(factory)
  }

  const globalFactory =
    typeof globalThis.indexedDB !== 'undefined'
      ? (globalThis.indexedDB as IDBFactoryLike)
      : undefined
  if (globalFactory === undefined) {
    return Result.fail(new ProjectStoreUnsupportedError())
  }

  return Result.succeed(globalFactory)
}

export const isQuotaError = (cause: unknown): boolean => {
  if (typeof cause !== 'object' || cause === null) {
    return false
  }

  const name =
    'name' in cause && typeof cause.name === 'string' ? cause.name : undefined
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
}

export const toOpenError = (cause: unknown): ProjectStoreOpenError =>
  new ProjectStoreOpenError({ cause })

export const toReadError = (cause: unknown): ProjectReadError =>
  new ProjectReadError({ cause })

export const toWriteError = (
  cause: unknown,
): ProjectWriteError | ProjectQuotaError =>
  isQuotaError(cause)
    ? new ProjectQuotaError({ cause })
    : new ProjectWriteError({ cause })

export const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

export const transactionToPromise = (
  transaction: IDBTransaction,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve(undefined)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })

const ensureStores = (database: IDBDatabase): void => {
  if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
    const store = database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' })
    store.createIndex('updatedAt', 'updatedAt', { unique: false })
  }

  if (!database.objectStoreNames.contains(PROJECT_DOCUMENTS_STORE)) {
    database.createObjectStore(PROJECT_DOCUMENTS_STORE, {
      keyPath: 'projectId',
    })
  }

  if (!database.objectStoreNames.contains(PROJECT_MEDIA_STORE)) {
    database.createObjectStore(PROJECT_MEDIA_STORE, {
      keyPath: 'projectId',
    })
  }
}

export const openProjectDatabase = (
  factory: IDBFactoryLike,
): Result.ResultAsync<IDBDatabase, ProjectStoreOpenError> =>
  Result.try({
    try: async () => {
      const request = factory.open(PROJECT_DB_NAME, PROJECT_DB_VERSION)
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onupgradeneeded = () => {
          ensureStores(request.result)
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        request.onblocked = () => {
          // Resolve with the open handle; blocked only delays version change.
        }
      })
      // Newer IndexedDB handles missing stores after version bumps by
      // relying on onupgradeneeded. Nothing else to do here.
      return database
    },
    catch: (cause) => toOpenError(cause),
  })

export const closeProjectDatabase = (database: IDBDatabase): void => {
  database.close()
}
