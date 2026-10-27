import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  OWNER_SETTABLE_STATUSES,
  PropertyType,
  createPropertySchema,
  enumValues,
  type ManagedAgentResponse,
  type PropertyDetail,
} from '@genuine-homes/shared';
import { propertiesApi } from '@/api/properties';
import { uploadsApi } from '@/api/uploads';
import {
  ImageUploader,
  hasPendingUploads,
  type GalleryImage,
} from '@/components/ImageUploader';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

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
  contactName: '',
  landlordName: '',
  unitCount: '',
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
        contactName: p.contactName ?? '',
        landlordName: p.landlordName ?? '',
        unitCount: p.unitCount?.toString() ?? '',
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
  // New listings prefill the contact name with the poster's account name; it
  // stays editable (the agent is the public contact for the listing).
  const accountName = useAuthStore((s) => s.user?.fullName) ?? '';
  const [form, setForm] = useState(() => {
    const base = toFormState(initialProperty);
    if (!initialProperty && !base.contactName) base.contactName = accountName;
    return base;
  });
  const [amenities, setAmenities] = useState<Record<string, boolean>>(
    () => initialProperty?.amenities ?? {},
  );
  // Optional landlord photo — uploaded on pick; we keep only the resulting URL.
  const [landlordImageUrl, setLandlordImageUrl] = useState<string>(
    () => initialProperty?.landlordImageUrl ?? '',
  );
  const [landlordUploading, setLandlordUploading] = useState(false);
  const onLandlordFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setLandlordUploading(true);
    try {
      const { url } = await uploadsApi.upload(file);
      setLandlordImageUrl(url);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLandlordUploading(false);
    }
  };
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

  // The rentals/installment flows drive status automatically, but owners can
  // also override it by hand here (e.g. mark a property taken or re-list it).
  // The selector offers the whole owner-settable set when editing.
  const statusEditable = isEdit && SETTABLE.includes(status);

  const mutation = useMutation({
    mutationFn: async () => {
      if (hasPendingUploads(images) || landlordUploading) {
        throw new Error('Wait for photos to finish uploading');
      }
      const parsed = createPropertySchema.safeParse({
        type: form.type,
        title: form.title,
        description: form.description,
        district: form.district,
        city: form.city,
        area: form.area.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        landlordName: form.landlordName.trim(),
        landlordImageUrl: landlordImageUrl || undefined,
        unitCount: numOrUndef(form.unitCount),
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
        setForm({ ...BLANK, contactName: accountName });
        setAmenities({});
        setImages([]);
        setLandlordImageUrl('');
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
    <div className="space-y-4">
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

        <div>
          <label className="label">
            Contact name <span className="text-stone-400">(agent / owner)</span>
          </label>
          <input
            className="input"
            value={form.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            placeholder="Shown on the listing as “Listed by”"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Landlord / owner name</label>
            <input
              className="input"
              value={form.landlordName}
              onChange={(e) => set('landlordName', e.target.value)}
              placeholder="The land-owner this property belongs to"
            />
            <p className="mt-1 text-xs text-stone-400">
              Shown on the listing. Tenants deal with you (the agent), not the landlord.
            </p>
          </div>
          <div>
            <label className="label">
              Landlord photo <span className="text-stone-400">(optional)</span>
            </label>
            <div className="flex items-center gap-3">
              {landlordImageUrl && (
                <img
                  src={landlordImageUrl}
                  alt="Landlord"
                  className="h-14 w-14 rounded-full object-cover"
                />
              )}
              <div className="space-y-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onLandlordFile}
                  disabled={landlordUploading || mutation.isPending}
                  className="text-sm"
                />
                {landlordUploading && <p className="text-xs text-stone-400">Uploading…</p>}
                {landlordImageUrl && !landlordUploading && (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => setLandlordImageUrl('')}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="label">
            Number of units <span className="text-stone-400">(optional)</span>
          </label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.unitCount}
            onChange={(e) => set('unitCount', e.target.value)}
            placeholder="For a whole apartment block a manager runs"
          />
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
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
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
            disabled={mutation.isPending || hasPendingUploads(images) || landlordUploading}
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

      {isEdit && initialProperty && <AssignedAgents propertyId={initialProperty.id} />}
    </div>
  );
}

/**
 * Manage the agents an owner/manager has assigned to help run a property (e.g. a
 * manager's apartment block). Assigned agents receive and can act on the
 * property's viewing requests. Live against the property's /agents endpoints.
 */
function AssignedAgents({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const key = ['property-agents', propertyId];

  const { data: agents = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => propertiesApi.listAgents(propertyId),
  });

  const assign = useMutation({
    mutationFn: (value: string) => propertiesApi.assignAgent(propertyId, value),
    onSuccess: (agent) => {
      setEmailOrPhone('');
      toast.success(`${agent.fullName} assigned`);
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const unassign = useMutation({
    mutationFn: (agentId: string) => propertiesApi.unassignAgent(propertyId, agentId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const value = emailOrPhone.trim();
    if (value) assign.mutate(value);
  };

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h3 className="font-semibold text-stone-800">Assigned agents</h3>
        <p className="text-sm text-stone-500">
          Agents you assign can handle this property’s viewing requests and tenants.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-stone-400">No agents assigned yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {agents.map((a: ManagedAgentResponse) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-stone-800">{a.fullName}</p>
                <p className="text-xs text-stone-500">
                  {a.phone}
                  {a.email ? ` · ${a.email}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                disabled={unassign.isPending}
                onClick={() => unassign.mutate(a.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="flex gap-2" onSubmit={onAdd}>
        <input
          className="input flex-1"
          value={emailOrPhone}
          onChange={(e) => setEmailOrPhone(e.target.value)}
          placeholder="Agent’s email or phone"
        />
        <button
          className="btn-outline"
          type="submit"
          disabled={assign.isPending || emailOrPhone.trim() === ''}
        >
          {assign.isPending ? 'Adding…' : 'Assign'}
        </button>
      </form>
    </section>
  );
}
