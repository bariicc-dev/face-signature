export type ServiceCatalogItem = {
  id: string;
  category: string;
  name: string;
  price: number;
  old_price: number | null;
  duration: number;
  note: string | null;
  active: boolean;
  sort_order: number;
};

export const OFFICIAL_SERVICES: ServiceCatalogItem[] = [
  { id: 'mb1', category: 'Sourcils', name: 'Microshading', price: 99, old_price: 180, duration: 90, note: null, active: true, sort_order: 1 },
  { id: 'mb2', category: 'Sourcils', name: 'Microblading', price: 120, old_price: 220, duration: 120, note: null, active: true, sort_order: 2 },
  { id: 'mb3', category: 'Sourcils', name: 'Powder Brow', price: 120, old_price: 220, duration: 120, note: null, active: true, sort_order: 3 },
  { id: 'mb4', category: 'Sourcils', name: 'Brow Lift', price: 50, old_price: null, duration: 45, note: null, active: true, sort_order: 4 },
  { id: 'mb5', category: 'Sourcils', name: 'Détatouage sourcils', price: 50, old_price: null, duration: 60, note: 'à partir de 50€', active: true, sort_order: 5 },
  { id: 'mb6', category: 'Sourcils', name: 'Reprise (correction)', price: 140, old_price: null, duration: 90, note: null, active: true, sort_order: 6 },
  { id: 'mb7', category: 'Sourcils', name: 'Retouche sourcils 1 mois', price: 70, old_price: null, duration: 60, note: null, active: true, sort_order: 7 },
  { id: 'mb8', category: 'Sourcils', name: 'Retouche sourcils 3 mois', price: 80, old_price: null, duration: 60, note: null, active: true, sort_order: 8 },
  { id: 'mb9', category: 'Sourcils', name: 'Retouche sourcils 6 mois', price: 90, old_price: null, duration: 60, note: null, active: true, sort_order: 9 },
  { id: 'mb10', category: 'Sourcils', name: 'Retouche sourcils 1 an', price: 100, old_price: null, duration: 60, note: null, active: true, sort_order: 10 },
  { id: 'mb11', category: 'Sourcils', name: 'Anesthésie', price: 10, old_price: null, duration: 15, note: null, active: true, sort_order: 11 },
  { id: 'cl1', category: 'Candelips & Eyeliner', name: 'Candelips', price: 160, old_price: 250, duration: 120, note: null, active: true, sort_order: 12 },
  { id: 'cl2', category: 'Candelips & Eyeliner', name: 'Retouche Candelips 1 mois', price: 80, old_price: 120, duration: 60, note: null, active: true, sort_order: 13 },
  { id: 'cl3', category: 'Candelips & Eyeliner', name: 'Eyeliner', price: 150, old_price: 230, duration: 90, note: null, active: true, sort_order: 14 },
  { id: 'cl4', category: 'Candelips & Eyeliner', name: 'Retouche Eyeliner', price: 70, old_price: null, duration: 60, note: null, active: true, sort_order: 15 },
  { id: 'cd1', category: 'Cils & Dents', name: 'Extension de cils', price: 50, old_price: null, duration: 90, note: 'à partir de 50€', active: true, sort_order: 16 },
  { id: 'cd3', category: 'Cils & Dents', name: 'Effets volume russe', price: 70, old_price: null, duration: 75, note: null, active: true, sort_order: 17 },
  { id: 'cd2', category: 'Cils & Dents', name: 'Blanchiment dents', price: 70, old_price: 150, duration: 45, note: null, active: true, sort_order: 18 },
];

const OFFICIAL_BY_ID = new Map(OFFICIAL_SERVICES.map((service) => [service.id, service]));

export function getOfficialService(id?: string | null) {
  return id ? OFFICIAL_BY_ID.get(id) || null : null;
}

export function getDisplayServices(services?: Partial<ServiceCatalogItem>[] | null) {
  const existingById = new Map((services || []).map((service) => [service.id, service]));
  return OFFICIAL_SERVICES
    .filter((service) => service.active)
    .map((service) => ({ ...existingById.get(service.id), ...service }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function formatServicePrice(service: { price: number; note?: string | null }) {
  return service.note?.toLowerCase().startsWith('à partir') ? service.note : `${service.price}€`;
}

export function serviceUpsertPayload(service: ServiceCatalogItem) {
  return {
    id: service.id,
    category: service.category,
    name: service.name,
    price: service.price,
    old_price: service.old_price,
    duration: service.duration,
    note: service.note,
    active: service.active,
    sort_order: service.sort_order,
  };
}
