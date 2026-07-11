/**
 * PlaceTypeIcon — Circum icon (react-icons/ci) + color per place type
 */

import { Card } from '@blueprintjs/core';
import type { IconType } from 'react-icons';
import { CiBank, CiForkAndKnife, CiStar, CiCoffeeCup, CiHospital1, CiMapPin } from 'react-icons/ci';
import type { PlaceType } from '../types/api';

export const PLACE_TYPE_CONFIG: Record<
  PlaceType,
  { color: string; Icon: IconType; label: string }
> = {
  school: { color: '#2D72D2', Icon: CiBank, label: 'School' },
  restaurant: { color: '#CD4246', Icon: CiForkAndKnife, label: 'Restaurant' },
  attraction: { color: '#D9822B', Icon: CiStar, label: 'Attraction' },
  cafe: { color: '#634DBF', Icon: CiCoffeeCup, label: 'Cafe' },
  hospital: { color: '#C22762', Icon: CiHospital1, label: 'Hospital' },
  other: { color: '#5F6B7C', Icon: CiMapPin, label: 'Other' },
};

export function PlaceTypeIcon({ type, size = 18 }: { type: PlaceType; size?: number }) {
  const { Icon, color, label } = PLACE_TYPE_CONFIG[type];
  return <Icon color={color} size={size} title={label} />;
}

/**
 * Legend showing all place types
 */
export function PlaceLegend() {
  return (
    <Card compact style={{ padding: 12 }}>
      <h6 className="bp6-heading" style={{ marginBottom: 8 }}>
        Place Types
      </h6>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(PLACE_TYPE_CONFIG).map(([type, c]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <c.Icon color={c.color} size={18} />
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
