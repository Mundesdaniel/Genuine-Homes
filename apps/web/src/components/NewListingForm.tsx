import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ListingType,
  RentPeriod,
  createListingSchema,
  enumValues,
  type PropertySummary,
} from '@genuine-homes/shared';
import { propertiesApi } from '@/api/properties';
import {
  ImageUploader,
  hasPendingUploads,
  type GalleryImage,
} from '@/components/ImageUploader';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';

const numOrUndef = (s: string) => (s.trim() === '' ? undefined : Number(s));

export function NewListingForm({
  properties,
  onCreated,
}: {
  properties: PropertySummary[];
  onCreated: () => void;
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '');
  const [listingType, setListingType] = useState('rent');
  const [price, setPrice] = useState('');
  const [rentPeriod, setRentPeriod] = useState('monthly');
  const [minDepositPercent, setMinDepositPercent] = useState('20');
  const [maxInstallmentMonths, setMaxInstallmentMonths] = useState('24');
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!propertyId) throw new Error('Choose a property first');
      if (hasPendingUploads(images)) {
        throw new Error('Wait for photos to finish uploading');
      }
      const input: Record<string, unknown> = {
        listingType,
        price: numOrUndef(price),
        currency: 'UGX',
      };
      if (listingType === 'rent') input.rentPeriod = rentPeriod;
      if (listingType === 'installment') {
        input.minDepositPercent = numOrUndef(minDepositPercent);
        input.maxInstallmentMonths = numOrUndef(maxInstallmentMonths);
      }
      const parsed = createListingSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      const listing = await propertiesApi.addListing(propertyId, parsed.data);
      // Any photos added here are appended to the selected property's gallery.
      for (const img of images) {
        if (img.status === 'ready' && img.url) {
          await propertiesApi.addImage(propertyId, img.url);
        }
      }
      return listing;
    },
    onSuccess: () => {
      setPrice('');
      setImages([]);
      toast.success('Listing added');
      onCreated();
    },
    onError: (e) => {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
    },
  });

  if (properties.length === 0) {
    return (
      <div className="card p-5 text-sm text-stone-500">
        Create a property first, then you can add a listing to it.
      </div>
    );
  }

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
    >
      <h3 className="font-semibold text-stone-800">New listing</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Property</label>
          <select
            className="input"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Listing type</label>
          <select
            className="input"
            value={listingType}
            onChange={(e) => setListingType(e.target.value)}
          >
            {enumValues(ListingType).map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Price (UGX)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        {listingType === 'rent' && (
          <div>
            <label className="label">Rent period</label>
            <select
              className="input"
              value={rentPeriod}
              onChange={(e) => setRentPeriod(e.target.value)}
            >
              {enumValues(RentPeriod).map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {listingType === 'installment' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Min deposit (%)</label>
            <input
              className="input"
              type="number"
              value={minDepositPercent}
              onChange={(e) => setMinDepositPercent(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Max months</label>
            <input
              className="input"
              type="number"
              value={maxInstallmentMonths}
              onChange={(e) => setMaxInstallmentMonths(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="border-t border-stone-100 pt-4">
        <ImageUploader images={images} setImages={setImages} disabled={mutation.isPending} />
        <p className="mt-1 text-xs text-stone-400">
          Photos are added to the selected property’s gallery.
        </p>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        className="btn-primary"
        type="submit"
        disabled={mutation.isPending || hasPendingUploads(images)}
      >
        {mutation.isPending ? 'Adding…' : 'Add listing'}
      </button>
    </form>
  );
}
