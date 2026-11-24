'use client';

import { useEffect, useState } from 'react';

import { TextButton } from './button';

export interface ResendCodeLabels {
  /** Has the place {time} for the minutes and seconds left. */
  readonly resendIn: string;
  readonly resend: string;
}

interface ResendCodeProps {
  readonly labels: ResendCodeLabels;
  /** From this moment another code can be asked for. Milliseconds since 1970. */
  readonly resendAt: number;
  readonly disabled: boolean;
  readonly onResend: () => void;
}

/** Seconds left until a moment in time, counted once a second. Undefined until the first count. */
function useSecondsUntil(moment: number): number | undefined {
  const [secondsLeft, setSecondsLeft] = useState<number>();

  useEffect(() => {
    const count = (): void => {
      setSecondsLeft(Math.max(0, Math.ceil((moment - Date.now()) / 1000)));
    };
    const first = setTimeout(count, 0);
    const timer = setInterval(count, 1000);

    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [moment]);

  return secondsLeft;
}

function minutesAndSeconds(seconds: number): string {
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Under a one-time code: how long to wait for another one, then the button that asks for it. */
export function ResendCode({ labels, resendAt, disabled, onResend }: ResendCodeProps) {
  const secondsLeft = useSecondsUntil(resendAt);

  if (secondsLeft === undefined) {
    return null;
  }

  return secondsLeft > 0 ? (
    <span className="text-[13px] font-bold text-gray-600 tabular-nums">
      {labels.resendIn.replace('{time}', minutesAndSeconds(secondsLeft))}
    </span>
  ) : (
    <TextButton disabled={disabled} onClick={onResend}>
      {labels.resend}
    </TextButton>
  );
}
