import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  PropertyType,
  createPropertySchema,
  enumValues,
} from '@genuine-homes/shared';
import { propertiesApi } from '@/api/properties';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';

const COMMON_AMENITIES = ['water', 'power', 'fence', 'parking', 'wifi', 'furnished'];
const numOrUndef = (s: string) => (s.trim() === '' ? undefined : Number(s));

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

export function NewPropertyForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ ...BLANK });
  const [amenities, setAmenities] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
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
        status: 'active',
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      return propertiesApi.create(parsed.data);
    },
    onSuccess: () => {
      setForm({ ...BLANK });
      setAmenities({});
      onCreated();
    },
    onError: (e) => setError(apiErrorMessage(e)),
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
      <h3 className="font-semibold text-stone-800">New property</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
            {enumValues(PropertyType).map((t) => (
              <option key={t} value={t}>{titleCase(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Title</label>
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
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
          <input className="input" value={form.district} onChange={(e) => set('district', e.target.value)} />
        </div>
        <div>
          <label className="label">City</label>
          <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div>
          <label className="label">Area</label>
          <input className="input" value={form.area} onChange={(e) => set('area', e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Bedrooms</label>
          <input className="input" type="number" min={0} value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
        </div>
        <div>
          <label className="label">Bathrooms</label>
          <input className="input" type="number" min={0} value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
        </div>
        <div>
          <label className="label">Size (m²)</label>
          <input className="input" type="number" min={0} value={form.sizeSqm} onChange={(e) => set('sizeSqm', e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Latitude <span className="text-stone-400">(optional)</span></label>
          <input className="input" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="0.3325" />
        </div>
        <div>
          <label className="label">Longitude <span className="text-stone-400">(optional)</span></label>
          <input className="input" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="32.6155" />
        </div>
      </div>

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

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button className="btn-primary" type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating…' : 'Create property'}
      </button>
    </form>
  );
}
