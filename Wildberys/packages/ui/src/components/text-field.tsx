import type { InputHTMLAttributes, ReactNode } from 'react';

import { Field, fieldBoxClasses, fieldTextClasses } from './field';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  /** Shown in front of the text, for example an envelope for an email. */
  readonly icon?: ReactNode;
  /** Shown after the text, for example the button that shows a password. */
  readonly trailing?: ReactNode;
  /** A short line under the field, for example what a password must be like. */
  readonly hint?: string;
}

export function TextField({
  label,
  icon,
  trailing,
  hint,
  className = '',
  ...props
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} className={className}>
      <span className={fieldBoxClasses}>
        {icon}
        <input
          className={`min-w-0 flex-1 bg-transparent placeholder:text-gray-400 ${fieldTextClasses}`}
          {...props}
        />
        {trailing}
      </span>
    </Field>
  );
}
