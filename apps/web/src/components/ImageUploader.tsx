import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { IMAGE_UPLOAD, addImageSchema } from '@genuine-homes/shared';
import { propertiesApi } from '@/api/properties';
import { uploadsApi } from '@/api/uploads';
import { apiErrorMessage } from '@/lib/apiClient';

/** One image in the gallery being assembled. `url` is empty until the file
 *  finishes uploading; `previewUrl` is a local object URL shown meanwhile.
 *  `imageId` is set once the image is persisted to a property (live/edit mode). */
export interface GalleryImage {
  key: string;
  url: string;
  status: 'uploading' | 'ready';
  previewUrl?: string;
  imageId?: string;
}

/** True while any image is still uploading — callers disable submit on this. */
export const hasPendingUploads = (images: GalleryImage[]): boolean =>
  images.some((i) => i.status === 'uploading');

let counter = 0;
const nextKey = () => `img-${counter++}`;

const MAX_MB = Math.round(IMAGE_UPLOAD.MAX_BYTES / (1024 * 1024));
const ACCEPTED = IMAGE_UPLOAD.ACCEPTED_MIME_TYPES as readonly string[];

export function ImageUploader({
  images,
  setImages,
  disabled,
  propertyId,
}: {
  images: GalleryImage[];
  setImages: Dispatch<SetStateAction<GalleryImage[]>>;
  disabled?: boolean;
  /** When set, the uploader persists adds/removes to this property's gallery
   *  immediately (edit mode). When omitted, images are only collected and the
   *  parent attaches them after the property is created (create mode). */
  propertyId?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');

  const atCap = images.length >= IMAGE_UPLOAD.MAX_PER_PROPERTY;
  const remaining = IMAGE_UPLOAD.MAX_PER_PROPERTY - images.length;

  const remove = (key: string) => {
    const found = images.find((i) => i.key === key);
    if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
    // In edit mode, delete the persisted image from the property too.
    if (propertyId && found?.imageId) {
      propertiesApi.removeImage(propertyId, found.imageId).catch((e) => {
        toast.error(`Couldn't remove photo: ${apiErrorMessage(e)}`);
      });
    }
    setImages((prev) => prev.filter((i) => i.key !== key));
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const picked = Array.from(fileList).slice(0, Math.max(0, remaining));
    if (fileList.length > picked.length) {
      toast.error(`You can attach up to ${IMAGE_UPLOAD.MAX_PER_PROPERTY} photos`);
    }

    for (const file of picked) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > IMAGE_UPLOAD.MAX_BYTES) {
        toast.error(`${file.name}: larger than ${MAX_MB}MB`);
        continue;
      }
      const key = nextKey();
      const previewUrl = URL.createObjectURL(file);
      setImages((prev) => [...prev, { key, url: '', status: 'uploading', previewUrl }]);
      uploadsApi
        .upload(file)
        .then(async (res) => {
          // Edit mode: attach to the live property right away.
          const imageId = propertyId
            ? (await propertiesApi.addImage(propertyId, res.url)).id
            : undefined;
          setImages((prev) =>
            prev.map((i) =>
              i.key === key ? { ...i, url: res.url, status: 'ready', imageId } : i,
            ),
          );
        })
        .catch((e) => {
          toast.error(`${file.name}: ${apiErrorMessage(e)}`);
          URL.revokeObjectURL(previewUrl);
          setImages((prev) => prev.filter((i) => i.key !== key));
        });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addUrl = () => {
    const parsed = addImageSchema.shape.url.safeParse(urlInput.trim());
    if (!parsed.success) {
      toast.error('Enter a valid image URL');
      return;
    }
    if (atCap) {
      toast.error(`You can attach up to ${IMAGE_UPLOAD.MAX_PER_PROPERTY} photos`);
      return;
    }
    const url = parsed.data;
    setUrlInput('');

    if (!propertyId) {
      setImages((prev) => [...prev, { key: nextKey(), url, status: 'ready' }]);
      return;
    }
    // Edit mode: persist immediately.
    const key = nextKey();
    setImages((prev) => [...prev, { key, url, status: 'uploading' }]);
    propertiesApi
      .addImage(propertyId, url)
      .then((created) =>
        setImages((prev) =>
          prev.map((i) =>
            i.key === key ? { ...i, status: 'ready', imageId: created.id } : i,
          ),
        ),
      )
      .catch((e) => {
        toast.error(apiErrorMessage(e));
        setImages((prev) => prev.filter((i) => i.key !== key));
      });
  };

  return (
    <div className="space-y-3">
      <label className="label">
        Photos <span className="text-stone-400">(optional)</span>
      </label>

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img, idx) => (
            <div
              key={img.key}
              className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
            >
              <img
                src={img.previewUrl ?? img.url}
                alt=""
                className="h-full w-full object-cover"
              />
              {img.status === 'uploading' && (
                <div className="absolute inset-0 grid place-items-center bg-white/60 text-xs font-medium text-stone-600">
                  Uploading…
                </div>
              )}
              {idx === 0 && img.status === 'ready' && (
                <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(img.key)}
                disabled={disabled}
                aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-black/55 px-1.5 text-sm leading-5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pick files */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-outline"
          disabled={disabled || atCap}
          onClick={() => fileInputRef.current?.click()}
        >
          + Add photos
        </button>
        <span className="text-xs text-stone-400">
          JPG, PNG, WebP, GIF or AVIF · up to {MAX_MB}MB each · first photo is the cover
        </span>
      </div>

      {/* Or paste a URL */}
      <div className="flex gap-2">
        <input
          className="input"
          type="url"
          placeholder="…or paste an image URL"
          value={urlInput}
          disabled={disabled || atCap}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addUrl();
            }
          }}
        />
        <button
          type="button"
          className="btn-outline shrink-0"
          disabled={disabled || atCap || urlInput.trim() === ''}
          onClick={addUrl}
        >
          Add
        </button>
      </div>
    </div>
  );
}
