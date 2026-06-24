import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <p className="text-6xl font-bold text-brand/30">404</p>
      <h1 className="mt-2 text-xl font-semibold text-stone-700">Page not found</h1>
      <Link to="/" className="btn-primary mt-6">
        Back to search
      </Link>
    </div>
  );
}
