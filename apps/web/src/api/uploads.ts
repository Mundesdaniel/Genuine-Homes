import type { DocumentUploadResponse, UploadResponse } from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

/** We don't set Content-Type — axios derives the multipart boundary from the
 *  FormData body automatically. */
const asFormData = (file: File): FormData => {
  const data = new FormData();
  data.append('file', file);
  return data;
};

export const uploadsApi = {
  /** Upload one image file. Returns the public URL to attach to a property. */
  upload: (file: File) =>
    api.post<UploadResponse>('/uploads', asFormData(file)).then((r) => r.data),
  /** Upload a verification document (land title, ID) to private storage.
   *  Returns the opaque key a verification submission references. */
  uploadDocument: (file: File) =>
    api
      .post<DocumentUploadResponse>('/uploads/documents', asFormData(file))
      .then((r) => r.data),
};
