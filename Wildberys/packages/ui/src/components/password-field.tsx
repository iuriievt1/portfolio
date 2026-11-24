'use client';

import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';

import { TextField, type TextFieldProps } from './text-field';

/** What the eye button does, for screen readers and as a hint. */
export interface PasswordToggleLabels {
  readonly show: string;
  readonly hide: string;
}

interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'icon' | 'trailing'> {
  readonly toggleLabels: PasswordToggleLabels;
}

/** A password with the eye button of the design: the person can look at what they typed. */
export function PasswordField({ toggleLabels, ...props }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const toggleLabel = shown ? toggleLabels.hide : toggleLabels.show;

  return (
    <TextField
      type={shown ? 'text' : 'password'}
      icon={<Lock />}
      trailing={
        <button
          type="button"
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-pressed={shown}
          className="-mr-1.5 flex size-8 flex-none items-center justify-center rounded-xs transition-colors outline-none hover:bg-gray-100 focus-visible:ring-4 focus-visible:ring-berry-500/14 hover:[&_svg]:text-gray-600"
          onClick={() => {
            setShown((value) => !value);
          }}
        >
          {shown ? <EyeOff /> : <Eye />}
        </button>
      }
      {...props}
    />
  );
}
