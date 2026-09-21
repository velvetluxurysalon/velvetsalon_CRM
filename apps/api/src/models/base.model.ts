/**
 * Base domain entity interface.
 * All domain models extend this.
 * IDs are strings to remain DB-agnostic (UUID, ULID, auto-increment, etc.).
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Utility type — removes DB-managed fields for create operations.
 */
export type CreateEntity<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Utility type — makes all fields optional for update operations.
 */
export type UpdateEntity<T extends BaseEntity> = Partial<CreateEntity<T>>;
