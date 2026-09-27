/** Minimal key-value persistence port, implemented by adapters (e.g. localStorage). */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
