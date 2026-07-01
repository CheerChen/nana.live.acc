// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Vitest's jsdom environment does not expose localStorage by default
// (Node's experimental localStorage requires --localstorage-file).
// Provide a minimal in-memory stub so components reading/writing
// theme + language preferences work in tests.
const store = new Map<string, string>();
const localStorageStub: Storage = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  removeItem: (key: string) => {
    store.delete(key);
  },
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  },
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageStub,
    configurable: true,
    writable: true,
  });
}
if (typeof globalThis.window !== 'undefined' && !window.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageStub,
    configurable: true,
    writable: true,
  });
}
