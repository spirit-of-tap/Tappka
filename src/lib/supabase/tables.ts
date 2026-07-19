import type { Database } from "./database.types";

/** Row shape of a public table, from the generated Database types. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/** Insertable shape of a public table, from the generated Database types. */
export type Insertable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/** Updatable shape of a public table, from the generated Database types. */
export type Updatable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
