/** A single image ready to be persisted by a storage strategy. */
export interface UploadFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

/** Where the persisted image can be fetched from. */
export interface StoredFile {
  url: string;
}

/**
 * Persists uploaded property images. Swapping the backing store (local disk in
 * dev, Cloudinary in production) is just a different implementation behind this
 * interface — the same Strategy pattern the payments module uses for gateways.
 */
export interface FileStorage {
  readonly name: string;
  save(file: UploadFile): Promise<StoredFile>;
}
