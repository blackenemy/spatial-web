/**
 * PlacesTable — Blueprint filterable table, synced with map selection
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  InputGroup,
  HTMLSelect,
  HTMLTable,
  Button,
  Spinner,
  Callout,
  NonIdealState,
  Tag,
  Alert,
} from '@blueprintjs/core';
import { useDebounce } from '../../hooks/useDebounce';
import { useListPlaces, useDeletePlace } from '../../hooks/usePlaces';
import { PLACE_TYPE_CONFIG } from '../../components/PlaceTypeIcon';
import type { Feature, PlaceType } from '../../types/api';
import { toast } from '../../toaster';
import EditPlaceForm from './EditPlaceForm';
import { getPointCoordinates, getGeometryLabel } from '../../lib/geometry';

interface Props {
  selectedPlaceId: string | null;
  onSelectPlace: (id: string | null) => void;
}

export default function PlacesTable({ selectedPlaceId, onSelectPlace }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PlaceType | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);

  const debouncedSearch = useDebounce(search, 300);
  const deleteMutation = useDeletePlace(deleteConfirmId || '');

  const { data, isLoading, error } = useListPlaces({
    q: debouncedSearch || undefined,
    type: typeFilter || undefined,
  });

  const features = data?.features || [];

  const types = useMemo(
    () => Array.from(new Set(features.map((f) => f.properties.type))) as PlaceType[],
    [features]
  );

  useEffect(() => {
    if (selectedPlaceId && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedPlaceId]);

  return (
    <div className="flex flex-col h-full" style={{ background: '#fff' }}>
      {/* Filters */}
      <div style={{ padding: 12, borderBottom: '1px solid rgba(17,20,24,0.15)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <InputGroup
          leftIcon="search"
          placeholder="Search by name..."
          value={search}
          onValueChange={setSearch}
          rightElement={search ? <Button icon="cross" variant="minimal" onClick={() => setSearch('')} /> : undefined}
        />
        <HTMLSelect
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.currentTarget.value as PlaceType | '')}
          fill
        >
          <option value="">All Types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {PLACE_TYPE_CONFIG[type].label}
            </option>
          ))}
        </HTMLSelect>
        <span className="bp6-text-muted bp6-text-small">
          {features.length} place{features.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        ) : error ? (
          <Callout intent="danger" title="Failed to load places" style={{ margin: 12 }}>
            {(error as Error).message}
          </Callout>
        ) : features.length === 0 ? (
          <NonIdealState icon="search" title="No places found" />
        ) : (
          <HTMLTable interactive striped style={{ width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Geometry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <PlaceRow
                  key={feature.id}
                  feature={feature}
                  isSelected={feature.id === selectedPlaceId}
                  onSelect={() => onSelectPlace(feature.id)}
                  onEdit={() => setEditingId(feature.id)}
                  isEditing={editingId === feature.id}
                  onEditClose={() => setEditingId(null)}
                  rowRef={selectedPlaceId === feature.id ? selectedRowRef : null}
                  onDeleteClick={() => setDeleteConfirmId(feature.id)}
                  isConfirmingDelete={deleteConfirmId === feature.id}
                />
              ))}
            </tbody>
          </HTMLTable>
        )}
      </div>

      <Alert
        isOpen={deleteConfirmId !== null}
        intent="danger"
        icon="trash"
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          deleteMutation.mutate(undefined, {
            onSuccess: () => {
              toast.success('Place deleted');
              setDeleteConfirmId(null);
            },
          });
        }}
        cancelButtonText="Cancel"
        confirmButtonText="Delete"
        loading={deleteMutation.isPending}
      >
        <p>Delete this place? This action cannot be undone.</p>
      </Alert>
    </div>
  );
}

interface PlaceRowProps {
  feature: Feature;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  isEditing: boolean;
  onEditClose: () => void;
  rowRef: React.RefObject<HTMLTableRowElement | null> | null;
  onDeleteClick: () => void;
  isConfirmingDelete: boolean;
}

function PlaceRow({
  feature,
  isSelected,
  onSelect,
  onEdit,
  isEditing,
  onEditClose,
  rowRef,
  onDeleteClick,
  isConfirmingDelete,
}: PlaceRowProps) {
  if (isEditing) {
    return (
      <tr>
        <td colSpan={3}>
          <EditPlaceForm feature={feature} onClose={onEditClose} />
        </td>
      </tr>
    );
  }

  const config = PLACE_TYPE_CONFIG[feature.properties.type];
  const coords = getPointCoordinates(feature.geometry);
  const geomLabel = getGeometryLabel(feature.geometry);

  return (
    <tr
      ref={rowRef}
      onClick={onSelect}
      style={{ cursor: 'pointer', background: isSelected ? 'rgba(45,114,210,0.15)' : undefined }}
    >
      <td>
        <div style={{ fontWeight: 500, marginBottom: 4 }} title={feature.properties.name}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
            {feature.properties.name}
          </div>
          {feature.properties.description && (
            <div className="bp6-text-muted bp6-text-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {feature.properties.description}
            </div>
          )}
        </div>
      </td>
      <td>
        <Tag icon={<config.Icon color={config.color} size={16} />} minimal round>
          {config.label}
        </Tag>
      </td>
      <td>
        <div className="bp6-text-small">
          <Tag minimal>{geomLabel}</Tag>
          {coords && (
            <div className="bp6-text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
            </div>
          )}
        </div>
      </td>
      <td>
        <Button
          icon="edit"
          variant="minimal"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        />
        <Button
          icon="trash"
          variant="minimal"
          size="small"
          intent="danger"
          loading={isConfirmingDelete}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick();
          }}
        />
      </td>
    </tr>
  );
}
