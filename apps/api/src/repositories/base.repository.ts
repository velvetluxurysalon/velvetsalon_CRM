/**
 * Base repository interface.
 * All feature repositories implement this contract.
 * The type parameter T represents the domain entity.
 * The type parameter ID represents the identifier type (string for MongoDB ObjectId etc.).
 */
export interface IRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
}

/**
 * Abstract base repository implementing common logic.
 * Feature repositories extend this with DB-specific implementations.
 */
export abstract class BaseRepository<T, ID = string> implements IRepository<T, ID> {
  abstract findById(id: ID): Promise<T | null>;
  abstract findAll(): Promise<T[]>;
  abstract create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  abstract update(id: ID, data: Partial<T>): Promise<T | null>;
  abstract delete(id: ID): Promise<boolean>;
}
