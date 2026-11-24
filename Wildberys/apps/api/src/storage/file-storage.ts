export interface FileToStore {
  /** Path of the file inside the storage, for example images/<id>/640.webp. */
  readonly key: string;
  readonly body: Buffer;
  readonly contentType: string;
}

/** Keeps files that anyone can read by their address. The rest of the API depends on this class, not on S3. */
export abstract class FileStorage {
  /** Saves a file. A key is written once: the file behind it never changes. */
  abstract put(file: FileToStore): Promise<void>;

  /** The address the file is read from. */
  abstract publicUrl(key: string): string;
}
