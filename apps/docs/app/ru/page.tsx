import type { Metadata } from 'next';
import { Landing } from '../../components/landing';
import { landingMetadata } from '../../lib/landing-metadata';
import '../globals.css';

export const metadata: Metadata = landingMetadata('ru');

export default function Page() {
  return (
    <div className="mink-landing-page">
      <Landing locale="ru" />
    </div>
  );
}
