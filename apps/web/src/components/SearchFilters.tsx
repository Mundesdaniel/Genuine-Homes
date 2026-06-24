import { useState } from 'react';
import {
  ListingType,
  PropertyType,
  enumValues,
} from '@genuine-homes/shared';
import { titleCase } from '@/lib/format';

// Filter form values are kept as strings (raw input) and converted by the page.
export interface FiltersValue {
  district: string;
  type: string;
  listingType: string;
  minPrice: string;
  maxPrice: string;
  minBedrooms: string;
  onlyVerified: boolean;
  sort: string;
}

export const EMPTY_FILTERS: FiltersValue = {
  district: '',
  type: '',
  listingType: '',
  minPrice: '',
  maxPrice: '',
  minBedrooms: '',
  onlyVerified: false,
  sort: '',
};

export function SearchFilters({
  initial,
  onApply,
}: {
  initial: FiltersValue;
  onApply: (value: FiltersValue) => void;
}) {
  const [draft, setDraft] = useState<FiltersValue>(initial);
  const set = <K extends keyof FiltersValue>(key: K, value: FiltersValue[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        Filters
      </h2>

      <div>
        <label className="label" htmlFor="f-listingType">Listing type</label>
        <select
          id="f-listingType"
          className="input"
          value={draft.listingType}
          onChange={(e) => set('listingType', e.target.value)}
        >
          <option value="">Any</option>
          {enumValues(ListingType).map((t) => (
            <option key={t} value={t}>{titleCase(t)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="f-type">Property type</label>
        <select
          id="f-type"
          className="input"
          value={draft.type}
          onChange={(e) => set('type', e.target.value)}
        >
          <option value="">Any</option>
          {enumValues(PropertyType).map((t) => (
            <option key={t} value={t}>{titleCase(t)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="f-district">District</label>
        <input
          id="f-district"
          className="input"
          placeholder="e.g. Kampala"
          value={draft.district}
          onChange={(e) => set('district', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="f-min">Min price</label>
          <input
            id="f-min"
            className="input"
            type="number"
            min={0}
            value={draft.minPrice}
            onChange={(e) => set('minPrice', e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="f-max">Max price</label>
          <input
            id="f-max"
            className="input"
            type="number"
            min={0}
            value={draft.maxPrice}
            onChange={(e) => set('maxPrice', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="f-beds">Min beds</label>
          <input
            id="f-beds"
            className="input"
            type="number"
            min={0}
            value={draft.minBedrooms}
            onChange={(e) => set('minBedrooms', e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="f-sort">Sort</label>
          <select
            id="f-sort"
            className="input"
            value={draft.sort}
            onChange={(e) => set('sort', e.target.value)}
          >
            <option value="">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-stone-300 text-brand focus:ring-brand"
          checked={draft.onlyVerified}
          onChange={(e) => set('onlyVerified', e.target.checked)}
        />
        Verified properties only
      </label>

      <div className="flex gap-2 pt-1">
        <button className="btn-primary flex-1" type="submit">
          Apply
        </button>
        <button
          className="btn-outline"
          type="button"
          onClick={() => {
            setDraft(EMPTY_FILTERS);
            onApply(EMPTY_FILTERS);
          }}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
