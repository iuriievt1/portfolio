import type { FileToStore } from './file-storage.js';

/**
 * Keeps files that nobody can read by an address: only the API reads them, for a person it has checked.
 * The rest of the API depends on this class, not on S3.
 */
export abstract class PrivateFileStorage {
  /** Saves a file. A key is written once: the file behind it never changes. */
  abstract put(file: FileToStore): Promise<void>;

  /** The content of the file with this key. */
  abstract get(key: string): Promise<Buffer>;

  /** Deletes the file with this key. Deleting a file that is not there is not an error. */
  abstract remove(key: string): Promise<void>;
}
