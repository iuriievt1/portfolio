'use client';

import type { FormHTMLAttributes } from 'react';

interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit'> {
  /** Called with the fields of the form when the person submits it. */
  readonly onFields: (fields: FormData) => void;
}

/**
 * A form that hands its fields to the app and keeps what was typed. After a mistake
 * the person corrects the field that was wrong instead of filling in the whole form again.
 */
export function Form({ onFields, ...props }: FormProps) {
  return (
    <form
      // For a form submitted before the page is ready: React holds it and runs it then.
      // Without an action the browser would send the fields itself, in the address of the page.
      action={onFields}
      // The usual way. React is not asked to run the action, because it empties the form afterwards.
      onSubmit={(event) => {
        event.preventDefault();
        onFields(new FormData(event.currentTarget));
      }}
      {...props}
    />
  );
}
