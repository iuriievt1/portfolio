'use client';

import { useState } from 'react';

interface CodeFieldProps {
  readonly name: string;
  readonly label: string;
  /** How many digits the code has. */
  readonly length: number;
}

/**
 * A one-time code shown as one box per digit. Behind the boxes is a single input,
 * so typing, pasting and the browser's code autofill work as usual.
 */
export function CodeField({ name, label, length }: CodeFieldProps) {
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <label className="relative block w-fit max-w-full">
      <span className="sr-only">{label}</span>
      <input
        name={name}
        value={code}
        onChange={(event) => {
          setCode(event.target.value.replace(/\D/g, '').slice(0, length));
        }}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        required
        minLength={length}
        maxLength={length}
        className="absolute inset-0 size-full cursor-text opacity-0"
      />
      <span aria-hidden className="flex gap-2.5">
        {Array.from({ length }, (_, index) => {
          const digit = code[index];
          const current = focused && index === Math.min(code.length, length - 1);
          const state = current
            ? 'border-2 border-berry-500 ring-4 ring-berry-500/14'
            : digit
              ? 'border-[1.5px] border-berry-200 bg-berry-50'
              : 'border-[1.5px] border-gray-300';

          return (
            <span
              key={index}
              className={`flex h-15 w-13 min-w-0 items-center justify-center rounded-sm text-2xl font-extrabold ${state}`}
            >
              {digit}
            </span>
          );
        })}
      </span>
    </label>
  );
}
