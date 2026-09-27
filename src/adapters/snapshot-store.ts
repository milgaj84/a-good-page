import type { AsyncKeyValue } from '../core/snapshots';
import type { KeyValueStore } from '../core/ports';

const DB_NAME = 'hearth-snapshots';
const STORE = 'kv';

function promised<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Storage request failed'));
  });
}

/** IndexedDB holds far more than localStorage, which stays reserved for drafts and settings. */
export class IndexedDbStore implements AsyncKeyValue {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open version storage'));
      request.onblocked = () => reject(new Error('Version storage is busy in another window'));
    }).catch((error: unknown) => { this.db = null; throw error; });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    const tx = db.transaction(STORE, mode);
    const result = promised(work(tx.objectStore(STORE)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Version storage transaction failed'));
    });
    return result;
  }

  async get(key: string): Promise<string | null> {
    const value = await this.run('readonly', (store) => store.get(key) as IDBRequest<unknown>);
    return typeof value === 'string' ? value : null;
  }

  async set(key: string, value: string): Promise<void> { await this.run('readwrite', (store) => store.put(value, key)); }
  async remove(key: string): Promise<void> { await this.run('readwrite', (store) => store.delete(key)); }
}

/** Fallback when IndexedDB is missing: the same async shape over the safe localStorage wrapper. */
export class SyncStoreAdapter implements AsyncKeyValue {
  constructor(private readonly store: KeyValueStore) {}
  async get(key: string): Promise<string | null> { return this.store.get(key); }
  async set(key: string, value: string): Promise<void> { this.store.set(key, value); }
  async remove(key: string): Promise<void> { this.store.remove(key); }
}

export function snapshotBackend(factory: IDBFactory | undefined, fallback: KeyValueStore): AsyncKeyValue {
  return factory ? new IndexedDbStore(factory) : new SyncStoreAdapter(fallback);
}
