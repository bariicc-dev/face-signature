import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { FabWA } from '@/components/FabWA';
import { LocationBlock } from '../page';

export default function LocationPage() {
  return (
    <>
      <Nav />
      <div className="page">
        <div className="page-head">
          <div className="eyebrow">Visite</div>
          <h1>Nous <em>trouver</em>.</h1>
          <p>Au cœur du 12ᵉ arrondissement.</p>
        </div>
        <LocationBlock />
      </div>
      <Footer />
      <FabWA />
    </>
  );
}
