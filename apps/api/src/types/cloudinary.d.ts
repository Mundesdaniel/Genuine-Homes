// Minimal ambient declaration for the OPTIONAL `cloudinary` package, so the
// Cloudinary storage strategy type-checks even when the package isn't
// installed. The real module is only required at runtime when CLOUDINARY_URL is
// configured (see cloudinary-file-storage.ts). Replace/remove once the real
// `cloudinary` (which ships its own types) is added as a dependency.
declare module 'cloudinary' {
  type UploadStreamCallback = (
    error: unknown,
    result: { secure_url?: string } | undefined,
  ) => void;

  export const v2: {
    uploader: {
      upload_stream(
        options: Record<string, unknown>,
        callback: UploadStreamCallback,
      ): { end(buffer: Buffer): void };
    };
  };
}
