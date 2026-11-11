import FavoritesView from '@/components/FavoritesView';

export const metadata = { title: 'Избранное' };

export default function FavoritesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Избранное</h1>
      <FavoritesView />
    </div>
  );
}
