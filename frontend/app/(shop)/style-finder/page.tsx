import type { Metadata } from 'next';
import StyleFinder from './StyleFinder';

export const metadata: Metadata = {
  title: 'Silk Style Finder',
  description:
    'A few quiet questions, and we will gather your silk edit — the pieces made for the way you rest, lounge and dress.',
};

export default function StyleFinderPage() {
  return <StyleFinder />;
}
