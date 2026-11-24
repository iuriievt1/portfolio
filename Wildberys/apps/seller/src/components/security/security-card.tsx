import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

interface SecurityCardProps {
  readonly icon: ReactNode;
  readonly title: string;
  /**
   * For a step of securing the account that is still to do: its place among the steps,
   * for example "Step 1 of 2". The step to take next stands out.
   */
  readonly step?: { readonly label: string; readonly next: boolean };
  /** A step that is done has a check mark on its icon. */
  readonly done?: boolean;
  /** What is set now, in a sentence. */
  readonly children: ReactNode;
  /** The button or the choice that changes it. */
  readonly action: ReactNode;
}

/** One line of the security settings: what it is, how it is set now and the way to change it. */
export function SecurityCard({
  icon,
  title,
  step,
  done = false,
  children,
  action,
}: SecurityCardProps) {
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-3.5 rounded-lg border border-gray-200 bg-white p-5">
      <span className="relative flex size-11 flex-none items-center justify-center rounded-sm bg-berry-100 text-berry-600 [&>svg]:size-5">
        {icon}
        {done ? (
          <span
            aria-hidden
            className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full border-2 border-white bg-green-500 text-white"
          >
            <Check className="size-3 stroke-[3.5]" />
          </span>
        ) : null}
      </span>
      <div className="min-w-0 flex-1 basis-64">
        {step ? (
          <p
            className={`mb-0.5 text-[11px] font-extrabold tracking-[0.12em] uppercase ${
              step.next ? 'text-berry-500' : 'text-gray-400'
            }`}
          >
            {step.label}
          </p>
        ) : null}
        <h2 className="text-base font-extrabold">{title}</h2>
        <div className="mt-0.5 text-[13px] font-semibold text-gray-600">{children}</div>
      </div>
      {action}
    </section>
  );
}
