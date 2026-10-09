import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DOCUMENT_UPLOAD,
  IDENTITY,
  type IdentityDocumentInput,
} from '@genuine-homes/shared';
import { identityApi } from '@/api/identity';
import { uploadsApi } from '@/api/uploads';
import { Badge, ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

const ACCEPT = DOCUMENT_UPLOAD.ACCEPTED_MIME_TYPES.join(',');

/** One labelled document slot: pick a file → uploads to private storage →
 *  holds the opaque key the submission references. */
function DocumentSlot({
  label,
  kind,
  required,
  value,
  onChange,
}: {
  label: string;
  kind: string;
  required?: boolean;
  value: IdentityDocumentInput | null;
  onChange: (doc: IdentityDocumentInput | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) => uploadsApi.uploadDocument(file),
    onSuccess: ({ key }) => {
      setError(null);
      onChange({ kind, key });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-700">
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept={ACCEPT}
          className="text-sm"
          aria-label={label}
          disabled={upload.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
          }}
        />
        {upload.isPending && <Spinner label="Uploading…" />}
        {value && !upload.isPending && <Badge label="Uploaded" tone="success" />}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function SubmitForm({ rejectedNotes }: { rejectedNotes?: string | null }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const isDeveloper = user?.role === 'developer';

  const [legalName, setLegalName] = useState(user?.fullName ?? '');
  const [nin, setNin] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [tin, setTin] = useState('');
  const [idFront, setIdFront] = useState<IdentityDocumentInput | null>(null);
  const [idBack, setIdBack] = useState<IdentityDocumentInput | null>(null);
  const [selfie, setSelfie] = useState<IdentityDocumentInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: identityApi.submit,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identity', 'me'] });
    },
    onError: (err) => setFormError(apiErrorMessage(err)),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const normalizedNin = nin.trim().toUpperCase();
    if (!IDENTITY.NIN_PATTERN.test(normalizedNin)) {
      setFormError('The NIN must be 14 characters, e.g. CM90012100ABCD.');
      return;
    }
    if (!idFront) {
      setFormError('A photo of the front of your National ID is required.');
      return;
    }
    if (isDeveloper && (!organizationName.trim() || !registrationNumber.trim())) {
      setFormError(
        'Developer accounts must include the company name and URSB registration number.',
      );
      return;
    }
    submit.mutate({
      legalName: legalName.trim(),
      nin: normalizedNin,
      documents: [idFront, idBack, selfie].filter(
        (d): d is IdentityDocumentInput => d !== null,
      ),
      ...(isDeveloper
        ? {
            organizationName: organizationName.trim(),
            registrationNumber: registrationNumber.trim(),
            ...(tin.trim() ? { tin: tin.trim() } : {}),
          }
        : {}),
    });
  };

  return (
    <form className="card max-w-xl space-y-4 p-5" onSubmit={onSubmit}>
      {rejectedNotes !== undefined && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Your previous submission was rejected
          {rejectedNotes ? `: ${rejectedNotes}` : '.'} Please fix the issue and submit
          again.
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="legalName">
          Full legal name (as on your National ID) *
        </label>
        <input
          id="legalName"
          className="input"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          minLength={2}
          maxLength={120}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="nin">
          National Identification Number (NIN) *
        </label>
        <input
          id="nin"
          className="input font-mono uppercase"
          value={nin}
          onChange={(e) => setNin(e.target.value)}
          placeholder="CM90012100ABCD"
          maxLength={IDENTITY.NIN_LENGTH}
          required
        />
        <p className="mt-1 text-xs text-stone-500">
          We never store your full NIN — only a masked form for review.
        </p>
      </div>

      {isDeveloper && (
        <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3">
          <legend className="px-1 text-sm font-medium text-stone-700">
            Company details (developers register as a company)
          </legend>
          <div>
            <label className="mb-1 block text-sm text-stone-600" htmlFor="orgName">
              Company name *
            </label>
            <input
              id="orgName"
              className="input"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              maxLength={160}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-600" htmlFor="regNo">
              URSB registration number *
            </label>
            <input
              id="regNo"
              className="input"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              maxLength={60}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-600" htmlFor="tin">
              TIN (optional)
            </label>
            <input
              id="tin"
              className="input"
              value={tin}
              onChange={(e) => setTin(e.target.value)}
              maxLength={30}
            />
          </div>
        </fieldset>
      )}

      <div className="space-y-3">
        <DocumentSlot
          label="National ID — front"
          kind="national_id_front"
          required
          value={idFront}
          onChange={setIdFront}
        />
        <DocumentSlot
          label="National ID — back"
          kind="national_id_back"
          value={idBack}
          onChange={setIdBack}
        />
        <DocumentSlot
          label="Selfie holding your ID"
          kind="selfie_with_id"
          value={selfie}
          onChange={setSelfie}
        />
        {isDeveloper && (
          <p className="text-xs text-stone-500">
            Tip: you can attach the certificate of incorporation as the “back” slot or
            send it during review if requested.
          </p>
        )}
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button className="btn-primary" type="submit" disabled={submit.isPending}>
        {submit.isPending ? 'Submitting…' : 'Submit for review'}
      </button>
      <p className="text-xs text-stone-500">
        Your documents are stored privately and only visible to the review team via
        expiring links. Review usually takes 1–2 business days.
      </p>
    </form>
  );
}

export function IdentityVerificationPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['identity', 'me'],
    queryFn: () => identityApi.me(),
  });

  if (isLoading) return <Spinner label="Loading your verification status…" />;
  if (isError)
    return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Identity verification</h1>
        <p className="text-sm text-stone-500">
          Verify who you are with your National ID before publishing properties — this
          is how we keep Genuine Homes free of fake listings.
        </p>
      </div>

      {data?.status === 'pending' && (
        <div className="card max-w-xl space-y-2 p-5">
          <Badge label="Awaiting review" tone="neutral" />
          <p className="text-sm text-stone-600">
            We received your submission ({data.ninMasked}) and will notify you once it
            has been reviewed.
          </p>
        </div>
      )}

      {data?.status === 'verified' && (
        <div className="card max-w-xl space-y-2 p-5">
          <Badge label="Identity verified" tone="success" />
          <p className="text-sm text-stone-600">
            {data.legalName} — {data.ninMasked}. You can publish properties.
          </p>
        </div>
      )}

      {(data === null || data === undefined) && <SubmitForm />}
      {data?.status === 'rejected' && <SubmitForm rejectedNotes={data.notes} />}
    </div>
  );
}
