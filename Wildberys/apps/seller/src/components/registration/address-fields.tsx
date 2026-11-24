import { TextField } from '@bluberi/ui/components/text-field';
import { MapPin } from 'lucide-react';

import { postalCodeField, type PostalAddress } from '../../registration/address';

export interface AddressLabels {
  readonly streetLabel: string;
  readonly cityLabel: string;
  readonly postalCodeLabel: string;
}

interface AddressFieldsProps {
  /** The country of the address: it says how a postal code is written. */
  readonly countryCode: string;
  readonly labels: AddressLabels;
  /** What the fields start with. */
  readonly address?: Partial<PostalAddress> | null;
  /** Called with what the person typed, for a form that keeps it. */
  readonly onType?: (change: Partial<PostalAddress>) => void;
}

/**
 * The street, the city and the postal code of an address in the country of the seller.
 * The form reads them by their names: street, city and postalCode.
 */
export function AddressFields({ countryCode, labels, address, onType }: AddressFieldsProps) {
  const postalCode = postalCodeField(countryCode);

  return (
    <>
      <TextField
        label={labels.streetLabel}
        icon={<MapPin />}
        name="street"
        autoComplete="address-line1"
        required
        minLength={2}
        maxLength={120}
        defaultValue={address?.street}
        onChange={(event) => {
          onType?.({ street: event.target.value });
        }}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
        <TextField
          label={labels.cityLabel}
          name="city"
          autoComplete="address-level2"
          required
          minLength={2}
          maxLength={120}
          defaultValue={address?.city}
          onChange={(event) => {
            onType?.({ city: event.target.value });
          }}
        />
        <TextField
          label={labels.postalCodeLabel}
          name="postalCode"
          autoComplete="postal-code"
          inputMode={postalCode.inputMode}
          required
          pattern={postalCode.pattern}
          maxLength={postalCode.maxLength}
          defaultValue={address?.postalCode}
          onChange={(event) => {
            onType?.({ postalCode: event.target.value });
          }}
        />
      </div>
    </>
  );
}
