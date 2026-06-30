/// <reference types="react-scripts" />

// Polyfill type declarations for ES2023 Array.prototype.toSorted,
// which TypeScript 4.x does not include (added in TS 5.0+).
interface Array<T> {
  toSorted(compareFn?: (a: T, b: T) => number): T[];
}
