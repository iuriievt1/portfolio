import { Building2, Check, Store, UserRound, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

import { registrationSteps, type RegistrationStep } from '../../registration/steps';

/** What each step is about, as a picture. */
const stepIcons: Record<RegistrationStep, ReactNode> = {
  account: <UserRound />,
  company: <Building2 />,
  payouts: <Wallet />,
  store: <Store />,
};

interface RegistrationStepsProps {
  /** The step of the page. The steps before it are shown as done. */
  readonly current: RegistrationStep;
  /** What the row is, for screen readers. */
  readonly label: string;
  /** The name of every step. It stands under its circle. */
  readonly names: Readonly<Record<RegistrationStep, string>>;
}

/**
 * Where a person is in the registration: a circle per step with a picture of what the step
 * is about and its name under it. A step that is done is filled and shows a check mark.
 */
export function RegistrationSteps({ current, label, names }: RegistrationStepsProps) {
  const currentIndex = registrationSteps.indexOf(current);

  return (
    <ol aria-label={label} className="flex items-start">
      {registrationSteps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;

        return (
          <li
            key={step}
            aria-current={active ? 'step' : undefined}
            className="flex flex-1 items-start last:flex-none"
          >
            {/* As wide as the longest name, so every name is in the middle under its circle. */}
            <span className="flex w-14 flex-none flex-col items-center gap-2">
              <span
                className={`flex size-10 items-center justify-center rounded-full border-2 transition-colors [&_svg]:size-4.5 ${
                  done
                    ? 'border-berry-500 bg-berry-500 text-white [&_svg]:stroke-3'
                    : active
                      ? 'border-berry-500 bg-white text-berry-600 ring-4 ring-berry-500/14'
                      : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                {done ? <Check /> : stepIcons[step]}
              </span>
              <span
                className={`text-xs font-bold whitespace-nowrap ${
                  done ? 'text-berry-950' : active ? 'text-berry-600' : 'text-gray-400'
                }`}
              >
                {names[step]}
              </span>
            </span>
            {index < registrationSteps.length - 1 ? (
              // In the middle of the height of a circle.
              <span
                aria-hidden
                className={`mt-4.75 h-0.5 flex-1 rounded-full ${done ? 'bg-berry-500' : 'bg-gray-200'}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
