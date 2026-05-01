import { redirect } from 'next/navigation';

// Root "/" always redirects to /home
// This must be a server component (no 'use client') for Next.js redirect to work on Vercel
export default function RootPage() {
  redirect('/home');
}
