/**
 * EditPlaceForm — inline Blueprint edit form for a place
 */

import { useState } from 'react';
import { InputGroup, HTMLSelect, Button, Callout, TextArea } from '@blueprintjs/core';
import { useUpdatePlace } from '../../hooks/usePlaces';
import { toast } from '../../toaster';
import type { Feature, PlaceType } from '../../types/api';
import { PLACE_TYPE_CONFIG } from '../../components/PlaceTypeIcon';

interface Props {
  feature: Feature;
  onClose: () => void;
}

export default function EditPlaceForm({ feature, onClose }: Props) {
  const [name, setName] = useState(feature.properties.name);
  const [type, setType] = useState(feature.properties.type);
  const [description, setDescription] = useState(feature.properties.description ?? '');

  const mutation = useUpdatePlace(feature.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({ name, type, description: description.trim() || null }, {
      onSuccess: () => {
        toast.success('Place updated');
        onClose();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
      <InputGroup placeholder="Name" value={name} onValueChange={setName} autoFocus />
      <HTMLSelect value={type} onChange={(e) => setType(e.currentTarget.value as PlaceType)} fill>
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
        rows={2}
      />
      {mutation.error && (
        <Callout intent="danger">{(mutation.error as Error).message}</Callout>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" intent="primary" loading={mutation.isPending} fill>
          Save
        </Button>
        <Button type="button" onClick={onClose} fill>
          Cancel
        </Button>
      </div>
    </form>
  );
}
