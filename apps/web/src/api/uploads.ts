import type { UploadResponse } from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const uploadsApi = {
  /** Upload one image file. Returns the public URL to attach to a property.
   *  We don't set Content-Type — axios derives the multipart boundary from the
   *  FormData body automatically. */
  upload: (file: File) => {
    const data = new FormData();
    data.append('file', file);
    return api.post<UploadResponse>('/uploads', data).then((r) => r.data);
  },
};
