import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

// Wrap JSON storage, not its string backend, to avoid serialization as well as I/O.
export function deduplicateStorage<S>(
  storage: PersistStorage<S> | undefined,
): PersistStorage<S> | undefined {
  if (!storage) return undefined;

  const writes = new Map<string, { value: StorageValue<S>; result: unknown }>();

  return {
    getItem: (name) => {
      // A rehydrate may read externally changed data. Establish a new baseline.
      writes.delete(name);
      return storage.getItem(name);
    },
    setItem: (name, value) => {
      const previous = writes.get(name);
      if (
        previous &&
        previous.value.version === value.version &&
        shallow(previous.value.state, value.state)
      ) {
        return previous.result;
      }

      writes.delete(name);
      const entry = { value, result: storage.setItem(name, value) };
      if (entry.result instanceof Promise) {
        entry.result = entry.result.catch((error: unknown) => {
          if (writes.get(name) === entry) writes.delete(name);
          throw error;
        });
      }
      writes.set(name, entry);
      return entry.result;
    },
    removeItem: (name) => {
      writes.delete(name);
      return storage.removeItem(name);
    },
  };
}
