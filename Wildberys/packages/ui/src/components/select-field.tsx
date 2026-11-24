import { ChevronDown } from 'lucide-react';
import type { ReactNode, SelectHTMLAttributes } from 'react';

import { Field, fieldBoxClasses, fieldTextClasses } from './field';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  readonly label: string;
  /** Shown in front of the chosen option, for example a globe for a country. */
  readonly icon?: ReactNode;
  readonly options: readonly SelectOption[];
  /** A short line under the field. */
  readonly hint?: string;
}

/**
 * A choice of one option from a list too long to show at once, like a country.
 * The list is the one of the device, so a phone shows its own wheel or sheet.
 */
export function SelectField({
  label,
  icon,
  options,
  hint,
  className = '',
  ...props
}: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} className={className}>
      <span className={`relative ${fieldBoxClasses}`}>
        {icon}
        {/* The list lies over the whole box, so a click anywhere in it opens the list. */}
        <select
          className={`absolute inset-0 size-full cursor-pointer appearance-none rounded-sm bg-transparent pr-10 ${
            icon ? 'pl-10.5' : 'pl-3.5'
          } ${fieldTextClasses}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none ml-auto flex-none" />
      </span>
    </Field>
  );
}
