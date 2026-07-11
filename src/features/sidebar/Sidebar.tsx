/**
 * Sidebar — left panel hub for all place data interaction
 * Modes: 'list' | 'detail' | 'edit' | 'add'
 */

import { useState } from 'react';
import {
  InputGroup,
  HTMLSelect,
  Button,
  Spinner,
  Callout,
  NonIdealState,
  Tag,
  Alert,
  TextArea,
} from '@blueprintjs/core';
import { useDebounce } from '../../hooks/useDebounce';
import {
  useListPlaces,
  useDeletePlace,
  useCreatePlace,
} from '../../hooks/usePlaces';
import { PLACE_TYPE_CONFIG } from '../../components/PlaceTypeIcon';
import type { Feature, PlaceType } from '../../types/api';
import { toast } from '../../toaster';
import EditPlaceForm from '../places-table/EditPlaceForm';
import { getPointCoordinates, getGeometryLabel } from '../../lib/geometry';

export type SidebarView = 'list' | 'detail' | 'edit' | 'add';

interface Props {
  view: SidebarView;
  selectedPlaceId: string | null;
  pendingCoords: [number, number] | null;
  onViewChange: (view: SidebarView) => void;
  onSelectPlace: (id: string | null) => void;
  onPendingCoordsChange: (coords: [number, number] | null) => void;
}

export default function Sidebar({
  view,
  selectedPlaceId,
  pendingCoords,
  onViewChange,
  onSelectPlace,
  onPendingCoordsChange,
}: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PlaceType | ''>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const deleteMutation = useDeletePlace(deleteConfirmId || '');

  const { data, isLoading, error } = useListPlaces({
    q: debouncedSearch || undefined,
    type: typeFilter || undefined,
  });

  const features = data?.features || [];
  const selectedFeature =
    selectedPlaceId && features.find((f) => f.id === selectedPlaceId);

  const types = Array.from(
    new Set(features.map((f) => f.properties.type))
  ) as PlaceType[];

  const handleDeleteConfirm = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success('Place deleted');
        setDeleteConfirmId(null);
        onSelectPlace(null);
        onViewChange('list');
      },
    });
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: '#fff', borderRight: '1px solid rgba(17,20,24,0.15)' }}
    >
      {/* Top navigation */}
      {view !== 'list' && (
        <div style={{ padding: 12, borderBottom: '1px solid rgba(17,20,24,0.15)' }}>
          <Button
            icon="chevron-left"
            minimal
            small
            onClick={() => {
              onViewChange('list');
              onSelectPlace(null);
              onPendingCoordsChange(null);
            }}
          >
            Back
          </Button>
        </div>
      )}

      {/* List Mode */}
      {view === 'list' && (
        <>
          {/* Add Button + minimal styling */}
          <div style={{ padding: 12, paddingBottom: 8 }}>
            <Button
              icon="plus"
              intent="primary"
              fill
              onClick={() => {
                onViewChange('add');
                onPendingCoordsChange(null);
              }}
            >
              Add Place
            </Button>
          </div>

          {/* Filters */}
          <div
            style={{
              padding: 12,
              paddingTop: 8,
              borderBottom: '1px solid rgba(17,20,24,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <InputGroup
              leftIcon="search"
              placeholder="Search by name..."
              value={search}
              onValueChange={setSearch}
              rightElement={
                search ? (
                  <Button
                    icon="cross"
                    variant="minimal"
                    onClick={() => setSearch('')}
                  />
                ) : undefined
              }
            />
            <HTMLSelect
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.currentTarget.value as PlaceType | '')
              }
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

          {/* Places List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div
                className="flex items-center justify-center"
                style={{ height: 200 }}
              >
                <Spinner size={16} />
              </div>
            ) : error ? (
              <Callout
                intent="danger"
                title="Failed to load places"
                style={{ margin: 12 }}
              >
                {(error as Error).message}
              </Callout>
            ) : features.length === 0 ? (
              <NonIdealState icon="search" title="No places found" />
            ) : (
              <div style={{ padding: 8 }}>
                {features.map((feature) => (
                  <PlaceListItem
                    key={feature.id}
                    feature={feature}
                    isSelected={feature.id === selectedPlaceId}
                    onSelect={() => {
                      onSelectPlace(feature.id);
                      onViewChange('detail');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail Mode */}
      {view === 'detail' && selectedFeature && (
        <PlaceDetailView
          feature={selectedFeature}
          onEdit={() => onViewChange('edit')}
          onDelete={() => setDeleteConfirmId(selectedFeature.id)}
        />
      )}

      {/* Edit Mode */}
      {view === 'edit' && selectedFeature && (
        <div style={{ flex: 1, overflow: 'y-auto', padding: 12 }}>
          <EditPlaceForm
            feature={selectedFeature}
            onClose={() => onViewChange('detail')}
          />
        </div>
      )}

      {/* Add Mode */}
      {view === 'add' && (
        <AddPlaceSidebar
          pendingCoords={pendingCoords}
          onPendingCoordsChange={onPendingCoordsChange}
          onSuccess={() => {
            onViewChange('list');
            onPendingCoordsChange(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <Alert
        isOpen={deleteConfirmId !== null}
        intent="danger"
        icon="trash"
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteConfirm}
        cancelButtonText="Cancel"
        confirmButtonText="Delete"
        loading={deleteMutation.isPending}
      >
        <p>
          Delete this place? This action cannot be undone.
        </p>
      </Alert>
    </div>
  );
}

/**
 * PlaceListItem — single item in the list
 */
function PlaceListItem({
  feature,
  isSelected,
  onSelect,
}: {
  feature: Feature;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const config = PLACE_TYPE_CONFIG[feature.properties.type];
  const geomLabel = getGeometryLabel(feature.geometry);

  return (
    <div
      onClick={onSelect}
      style={{
        padding: 12,
        marginBottom: 8,
        borderRadius: 4,
        cursor: 'pointer',
        background: isSelected
          ? 'rgba(45,114,210,0.15)'
          : 'rgba(0,0,0,0.02)',
        border: isSelected
          ? '1px solid rgba(45,114,210,0.3)'
          : '1px solid transparent',
      }}
    >
      <div style={{ fontWeight: 500, marginBottom: 4, wordBreak: 'break-word' }}>
        {feature.properties.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Tag icon={<config.Icon color={config.color} size={14} />} minimal round>
          {config.label}
        </Tag>
        <Tag minimal>{geomLabel}</Tag>
      </div>
      {feature.properties.description && (
        <div
          className="bp6-text-muted bp6-text-small"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {feature.properties.description}
        </div>
      )}
    </div>
  );
}

/**
 * PlaceDetailView — detail view of a selected place
 */
function PlaceDetailView({
  feature,
  onEdit,
  onDelete,
}: {
  feature: Feature;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const config = PLACE_TYPE_CONFIG[feature.properties.type];
  const coords = getPointCoordinates(feature.geometry);
  const geomLabel = getGeometryLabel(feature.geometry);

  return (
    <div
      className="flex flex-col"
      style={{ flex: 1, overflow: 'hidden', padding: 12, gap: 12 }}
    >
      <div style={{ overflow: 'y-auto' }}>
        <h5 className="bp6-heading" style={{ margin: 0, marginBottom: 8 }}>
          {feature.properties.name}
        </h5>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <Tag
            icon={<config.Icon color={config.color} size={16} />}
            minimal
            round
          >
            {config.label}
          </Tag>
          <Tag minimal>{geomLabel}</Tag>
        </div>

        {feature.properties.description ? (
          <p className="bp6-text-small" style={{ margin: 0, marginBottom: 12 }}>
            {feature.properties.description}
          </p>
        ) : (
          <p
            className="bp6-text-muted bp6-text-small"
            style={{ margin: 0, marginBottom: 12 }}
          >
            No description
          </p>
        )}

        {coords ? (
          <>
            <div
              className="bp6-text-muted bp6-text-small"
              style={{
                fontFamily: 'monospace',
                marginBottom: 8,
                wordBreak: 'break-all',
              }}
            >
              {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
            </div>

            <a
              className="bp6-text-small bp6-link"
              href={`https://www.google.com/maps?q=${coords[1]},${coords[0]}`}
              target="_blank"
              rel="noreferrer"
              style={{ marginBottom: 12, display: 'inline-block' }}
            >
              Open in Google Maps ↗
            </a>
          </>
        ) : (
          <div className="bp6-text-muted bp6-text-small" style={{ marginBottom: 12 }}>
            {geomLabel} geometry (coordinates view unavailable)
          </div>
        )}

        <div className="bp6-text-muted bp6-text-small">
          Added {new Date(feature.properties.createdAt).toLocaleString()}
        </div>
      </div>

      {/* Buttons at bottom */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(17,20,24,0.15)' }}>
        <Button icon="edit" intent="primary" onClick={onEdit} fill>
          Edit
        </Button>
        <Button icon="trash" intent="danger" onClick={onDelete} fill>
          Delete
        </Button>
      </div>
    </div>
  );
}

/**
 * AddPlaceSidebar — form to add a new place
 */
function AddPlaceSidebar({
  pendingCoords,
  onPendingCoordsChange,
  onSuccess,
}: {
  pendingCoords: [number, number] | null;
  onPendingCoordsChange: (coords: [number, number] | null) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PlaceType>('cafe');
  const [description, setDescription] = useState('');
  const createMutation = useCreatePlace();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !pendingCoords) return;

    await createMutation.mutateAsync({
      name: name.trim(),
      type,
      description: description.trim() || null,
      geometry: { type: 'Point', coordinates: pendingCoords },
    });

    toast.success('Place created');
    setName('');
    setDescription('');
    onPendingCoordsChange(null);
    onSuccess();
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        padding: 12,
        gap: 12,
      }}
    >
      <div style={{ overflow: 'y-auto' }}>
        <Callout intent="warning" icon="info-sign" style={{ marginBottom: 12 }}>
          Click on the map to set the location
        </Callout>

        {pendingCoords && (
          <div
            className="bp6-text-small"
            style={{
              marginBottom: 12,
              padding: 8,
              borderRadius: 4,
              background: 'rgba(13,148,136,0.1)',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            <div className="bp6-text-muted">Location:</div>
            <div>
              {pendingCoords[0].toFixed(4)}, {pendingCoords[1].toFixed(4)}
            </div>
          </div>
        )}

        <InputGroup
          placeholder="Place name (required)"
          value={name}
          onValueChange={setName}
          autoFocus
          style={{ marginBottom: 12 }}
        />

        <HTMLSelect
          value={type}
          onChange={(e) => setType(e.currentTarget.value as PlaceType)}
          fill
          style={{ marginBottom: 12 }}
        >
          {Object.entries(PLACE_TYPE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </HTMLSelect>

        <TextArea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          fill
          rows={3}
          style={{ marginBottom: 12 }}
        />

        {createMutation.error && (
          <Callout intent="danger" style={{ marginBottom: 12 }}>
            {(createMutation.error as Error).message}
          </Callout>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(17,20,24,0.15)' }}>
        <Button
          type="submit"
          intent="primary"
          loading={createMutation.isPending}
          disabled={!name.trim() || !pendingCoords}
          fill
        >
          Save
        </Button>
        <Button
          type="button"
          onClick={() => {
            setName('');
            setDescription('');
            onPendingCoordsChange(null);
          }}
          fill
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
