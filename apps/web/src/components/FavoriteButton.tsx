import { useLocation, useNavigate } from 'react-router-dom';
import { useFavoriteIds, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthStore } from '@/store/authStore';

/**
 * Heart toggle for saving a property. Used as an overlay on listing cards and
 * inline on the detail page. Stops click propagation so tapping it inside a
 * card link doesn't navigate; sends anonymous users to log in first.
 */
export function FavoriteButton({
  propertyId,
  variant = 'overlay',
}: {
  propertyId: string;
  variant?: 'overlay' | 'inline';
}) {
  const token = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const location = useLocation();
  const { ids } = useFavoriteIds();
  const toggle = useToggleFavorite();

  const saved = ids.has(propertyId);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      navigate('/login', { state: { from: location } });
      return;
    }
    toggle.mutate({ propertyId, saved });
  };

  const base =
    variant === 'overlay'
      ? 'absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:bg-white'
      : 'inline-flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium transition hover:bg-stone-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={toggle.isPending}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save property'}
      title={saved ? 'Remove from saved' : 'Save property'}
      className={base}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${saved ? 'fill-red-500 text-red-500' : 'fill-none text-stone-500'}`}
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 21s-7.5-4.6-10-9.3C.6 8.6 2 5.5 5 5.5c1.9 0 3.2 1.1 4 2.3.8-1.2 2.1-2.3 4-2.3 3 0 4.4 3.1 3 6.2C19.5 16.4 12 21 12 21z" />
      </svg>
      {variant === 'inline' && <span>{saved ? 'Saved' : 'Save'}</span>}
    </button>
  );
}
