'use client';
import { useParams } from 'next/navigation';
import BrowsePage from '@/components/ui/BrowsePage';
import { animeApi } from '@/lib/api';

export default function SubCategoryPage() {
  const { id } = useParams();
  const label = id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <BrowsePage
      title={label}
      fetchFn={(page) => animeApi.getSubCategory(id, page)}
    />
  );
}
