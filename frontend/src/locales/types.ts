import type en from "./en";

type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

/**
 * English is the source of truth. Every other locale must have exactly the
 * same keys: a missing or extra key is a type error.
 */
export type Messages = DeepStringify<typeof en>;
