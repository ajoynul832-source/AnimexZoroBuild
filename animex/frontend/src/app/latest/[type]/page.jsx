'use client';
import { useParams } from 'next/navigation';
import BrowsePage from '@/components/ui/BrowsePage';
import { animeApi } from '@/lib/api';

const FETCH_MAP = {
  subbed:  (p) => animeApi.getLatestSubbed(p),
  dubbed:  (p) => animeApi.getLatestDubbed(p),
  chinese: (p) => animeApi.getLatestChinese(p),
};

const TITLE_MAP = {
  subbed:  'Latest Subbed',
  dubbed:  'Latest Dubbed',
  chinese: 'Latest Chinese',
};

export default function LatestPage() {
  const { type } = useParams();
  const title   = TITLE_MAP[type] || `Latest ${type}`;
  const fetchFn = FETCH_MAP[type] || ((p) => animeApi.getLatestSubbed(p));
  return <BrowsePage title={title} fetchFn={fetchFn} />;
}
