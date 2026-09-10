import { describe, expect, it, vi } from 'vitest';
import { createJSONStorage } from 'zustand/middleware';

import { deduplicateStorage } from './deduplicateStorage';

function setup() {
  const backend = {
    getItem: vi.fn(async (): Promise<string | null> => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  };
  const storage = deduplicateStorage(
    createJSONStorage<{ data: object }>(() => backend),
  )!;
  return { backend, storage };
}

describe('deduplicateStorage', () => {
  it('compares shallow references, versions and storage keys', async () => {
    const { backend, storage } = setup();
    const data = { nested: [] };
    await storage.setItem('a', { state: { data }, version: 0 });
    await storage.setItem('a', { state: { data }, version: 0 });
    expect(backend.setItem).toHaveBeenCalledTimes(1);
    await storage.setItem('a', { state: { data }, version: 1 });
    await storage.setItem('b', { state: { data }, version: 1 });
    await storage.setItem('a', { state: { data: { ...data } }, version: 1 });
    expect(backend.setItem).toHaveBeenCalledTimes(4);
  });

  it('passes through asynchronous reads and resets the write baseline', async () => {
    const { backend, storage } = setup();
    const value = { state: { data: {} }, version: 0 };
    await storage.setItem('a', value);
    let resolve!: (value: string | null) => void;
    backend.getItem.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const read = storage.getItem('a');
    expect(read).toBeInstanceOf(Promise);
    resolve(JSON.stringify(value));
    await expect(read).resolves.toEqual(value);
    await storage.setItem('a', value);
    expect(backend.setItem).toHaveBeenCalledTimes(2);
  });

  it('deduplicates pending writes and permits retry after failure', async () => {
    const { backend, storage } = setup();
    const value = { state: { data: {} }, version: 0 };
    let reject!: (error: Error) => void;
    backend.setItem.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const write = storage.setItem('a', value);
    expect(storage.setItem('a', { ...value })).toBe(write);
    expect(backend.setItem).toHaveBeenCalledTimes(1);
    reject(new Error('Disk full'));
    await expect(write).rejects.toThrow('Disk full');
    await storage.setItem('a', value);
    expect(backend.setItem).toHaveBeenCalledTimes(2);
  });

  it('permits retry after synchronous failure', async () => {
    const { backend, storage } = setup();
    const value = { state: { data: {} }, version: 0 };
    backend.setItem.mockImplementationOnce(() => {
      throw new Error('Disk full');
    });
    expect(() => storage.setItem('a', value)).toThrow('Disk full');
    await storage.setItem('a', value);
    expect(backend.setItem).toHaveBeenCalledTimes(2);
  });

  it('does not invalidate a newer write when an older write fails', async () => {
    const { backend, storage } = setup();
    let reject!: (error: Error) => void;
    backend.setItem.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const oldWrite = storage.setItem('a', { state: { data: {} }, version: 0 });
    const newer = { state: { data: { updated: true } }, version: 0 };
    await storage.setItem('a', newer);
    reject(new Error('Old write failed'));
    await expect(oldWrite).rejects.toThrow('Old write failed');
    await storage.setItem('a', newer);
    expect(backend.setItem).toHaveBeenCalledTimes(2);
  });

  it('does not restore the baseline when a write finishes after removal', async () => {
    const { backend, storage } = setup();
    let resolve!: () => void;
    backend.setItem.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const value = { state: { data: {} }, version: 0 };
    const write = storage.setItem('a', value);
    await storage.removeItem('a');
    expect(backend.removeItem).toHaveBeenCalledExactlyOnceWith('a');
    resolve();
    await write;
    await storage.setItem('a', value);
    expect(backend.setItem).toHaveBeenCalledTimes(2);
  });
});
