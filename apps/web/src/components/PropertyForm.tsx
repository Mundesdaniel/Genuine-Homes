import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  OWNER_SETTABLE_STATUSES,
  PropertyType,
  createPropertySchema,
  enumValues,
  type PropertyDetail,
} from '@genuine-homes/shared';
import { propertiesApi } from '@/api/properties';
import {
  ImageUploader,
  hasPendingUploads,
  type GalleryImage,
} from '@/components/ImageUploader';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';

const COMMON_AMENITIES = ['water', 'power', 'fence', 'parking', 'wifi', 'furnished'];
const numOrUndef = (s: string) => (s.trim() === '' ? undefined : Number(s));
const SETTABLE = OWNER_SETTABLE_STATUSES as readonly string[];

const BLANK = {
  type: 'house',
  title: '',
  description: '',
  district: '',
  city: '',
  area: '',
  bedrooms: '',
  bathrooms: '',
  sizeSqm: '',
  latitude: '',
  longitude: '',
};

// Turn a loaded property into the string-keyed form state the inputs use.
const toFormState = (p?: PropertyDetail) =>
  p
    ? {
        type: p.type,
        title: p.title,
        description: p.description,
        district: p.district,
        city: p.city,
        area: p.area ?? '',
        bedrooms: p.bedrooms?.toString() ?? '',
        bathrooms: p.bathrooms?.toString() ?? '',
        sizeSqm: p.sizeSqm?.toString() ?? '',
        latitude: p.latitude?.toString() ?? '',
        longitude: p.longitude?.toString() ?? '',
      }
    : { ...BLANK };

/**
 * Create or edit a property. Pass `initialProperty` to edit (fields are
 * pre-filled and saved with PATCH; photos are managed live against the existing
 * gallery). Omit it to create (photos are attached after the property is made).
 */
export function PropertyForm({
  initialProperty,
  onSaved,
  onCancel,
}: {
  initialProperty?: PropertyDetail;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const isEdit = Boolean(initialProperty);
  const [form, setForm] = useState(() => toFormState(initialProperty));
  const [amenities, setAmenities] = useState<Record<string, boolean>>(
    () => initialProperty?.amenities ?? {},
  );
  const [status, setStatus] = useState<string>(() => initialProperty?.status ?? 'active');
  const [images, setImages] = useState<GalleryImage[]>(() =>
    (initialProperty?.images ?? []).map((img) => ({
      key: img.id,
      url: img.url,
      status: 'ready' as const,
      imageId: img.id,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Status is only owner-editable for draft/active/suspended (rented/sold are
  // driven by other flows), so only offer the selector for those.
  const statusEditable = isEdit && SETTABLE.includes(status);

  const mutation = useMutation({
    mutationFn: async () => {
      if (hasPendingUploads(images)) {
        throw new Error('Wait for photos to finish uploading');
      }
      const parsed = createPropertySchema.safeParse({
        type: form.type,
        title: form.title,
        description: form.description,
        district: form.district,
        city: form.city,
        area: form.area.trim() || undefined,
        bedrooms: numOrUndef(form.bedrooms),
        bathrooms: numOrUndef(form.bathrooms),
        sizeSqm: numOrUndef(form.sizeSqm),
        latitude: numOrUndef(form.latitude),
        longitude: numOrUndef(form.longitude),
        amenities,
        status: !isEdit ? 'active' : statusEditable ? status : undefined,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      if (initialProperty) {
        // Photos are already persisted live by the uploader in edit mode.
        return propertiesApi.update(initialProperty.id, parsed.data);
      }
      const property = await propertiesApi.create(parsed.data);
      // Attach photos in display order; sequential keeps gallery positions stable.
      for (const img of images) {
        if (img.status === 'ready' && img.url) {
          await propertiesApi.addImage(property.id, img.url);
        }
      }
      return property;
    },
    onSuccess: () => {
      if (!isEdit) {
        setForm({ ...BLANK });
        setAmenities({});
        setImages([]);
      }
      toast.success(isEdit ? 'Property updated' : 'Property created');
      onSaved();
    },
    onError: (e) => {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
    },
  });

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
    >
      <h3 className="font-semibold text-stone-800">
        {isEdit ? 'Edit property' : 'New property'}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
          >
            {enumValues(PropertyType).map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          className="input min-h-[80px]"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">District</label>
          <input
            className="input"
            value={form.district}
            onChange={(e) => set('district', e.target.value)}
          />
        </div>
        <div>
          <label className="label">City</label>
          <input
            className="input"
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Area</label>
          <input
            className="input"
            value={form.area}
            onChange={(e) => set('area', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Bedrooms</label>
          <input
            className="input"
            type="number"
            min={0}
            value={form.bedrooms}
            onChange={(e) => set('bedrooms', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Bathrooms</label>
          <input
            className="input"
            type="number"
            min={0}
            value={form.bathrooms}
            onChange={(e) => set('bathrooms', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Size (m²)</label>
          <input
            className="input"
            type="number"
            min={0}
            value={form.sizeSqm}
            onChange={(e) => set('sizeSqm', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">
            Latitude <span className="text-stone-400">(optional)</span>
          </label>
          <input
            className="input"
            value={form.latitude}
            onChange={(e) => set('latitude', e.target.value)}
            placeholder="0.3325"
          />
        </div>
        <div>
          <label className="label">
            Longitude <span className="text-stone-400">(optional)</span>
          </label>
          <input
            className="input"
            value={form.longitude}
            onChange={(e) => set('longitude', e.target.value)}
            placeholder="32.6155"
          />
        </div>
      </div>

      {statusEditable && (
        <div className="sm:w-1/2">
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {SETTABLE.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label">Amenities</label>
        <div className="flex flex-wrap gap-3">
          {COMMON_AMENITIES.map((a) => (
            <label key={a} className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 text-brand focus:ring-brand"
                checked={!!amenities[a]}
                onChange={(e) => setAmenities((m) => ({ ...m, [a]: e.target.checked }))}
              />
              {titleCase(a)}
            </label>
          ))}
        </div>
      </div>

      <ImageUploader
        images={images}
        setImages={setImages}
        disabled={mutation.isPending}
        propertyId={initialProperty?.id}
      />

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          className="btn-primary"
          type="submit"
          disabled={mutation.isPending || hasPendingUploads(images)}
        >
          {mutation.isPending
            ? isEdit
              ? 'Saving…'
              : 'Creating…'
            : isEdit
              ? 'Save changes'
              : 'Create property'}
        </button>
        {onCancel && (
          <button
            className="btn-outline"
            type="button"
            disabled={mutation.isPending}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
