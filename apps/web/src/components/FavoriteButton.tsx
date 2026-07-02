import { Heart } from 'lucide-react';
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
      // Same contract as ProtectedRoute: `from` is a path string.
      navigate('/login', { state: { from: location.pathname + location.search } });
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
      <Heart
        className={`h-5 w-5 transition ${saved ? 'fill-red-500 text-red-500' : 'text-stone-500'}`}
      />
      {variant === 'inline' && <span>{saved ? 'Saved' : 'Save'}</span>}
    </button>
  );
}
