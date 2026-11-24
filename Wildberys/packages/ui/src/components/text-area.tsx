import type { TextareaHTMLAttributes } from 'react';

import { Field, fieldAreaClasses, fieldTextClasses } from './field';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label: string;
  /** A short line under the field, for example who will read the text. */
  readonly hint?: string;
}

/** A field for a text of several lines, like a message. The person can make it taller. */
export function TextArea({ label, hint, className = '', rows = 4, ...props }: TextAreaProps) {
  return (
    <Field label={label} hint={hint} className={className}>
      <span className={fieldAreaClasses}>
        <textarea
          rows={rows}
          className={`min-h-12 w-full resize-y bg-transparent px-3.5 py-3 placeholder:text-gray-400 ${fieldTextClasses}`}
          {...props}
        />
      </span>
    </Field>
  );
}
