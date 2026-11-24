import { Button } from '@bluberi/ui/components/button';
import { CircleCheck, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

interface StepFrameProps {
  readonly title: string;
  /** One short sentence about what to do now. */
  readonly text?: string;
  /** Under the main button: the way back, or to the sign-in. */
  readonly secondary?: ReactNode;
  readonly children: ReactNode;
}

/** One step of the registration: a title, one sentence, the fields with one main button, and the way back. */
export function StepFrame({ title, text, secondary, children }: StepFrameProps) {
  return (
    <div className="mt-8 flex animate-step-in flex-col">
      {/* As large as one line of a phone allows. */}
      <h1 className="text-[clamp(1.375rem,6vw,1.75rem)] leading-tight font-extrabold tracking-[-0.02em]">
        {title}
      </h1>
      {text ? <p className="mt-1.5 text-[15px] font-medium text-gray-600">{text}</p> : null}
      <div className="mt-6 flex flex-col gap-4">{children}</div>
      {secondary ? (
        <div className="mt-4 flex justify-center text-sm font-semibold text-gray-600">
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

/** The look of a link under the main button. */
export const secondaryLink =
  'inline-flex items-center gap-1.5 rounded-xs font-bold text-berry-600 transition-colors outline-none hover:text-berry-700 focus-visible:ring-4 focus-visible:ring-berry-500/14 [&_svg]:size-4';

interface SubmitButtonProps {
  /** The step is waiting for the API: the button cannot be pressed again and shows it is working. */
  readonly busy: boolean;
  /** The gradient is for the button that ends the registration. */
  readonly variant?: 'primary' | 'gradient';
  /** Shown after the text, for example an arrow. */
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}

/** The one main button of a step. */
export function SubmitButton({ busy, variant = 'primary', icon, children }: SubmitButtonProps) {
  return (
    <Button type="submit" size="lg" variant={variant} className="w-full" disabled={busy}>
      {children}
      {busy ? <LoaderCircle className="animate-spin" /> : icon}
    </Button>
  );
}

interface DoneRowProps {
  /** A way to change what was done. */
  readonly action?: ReactNode;
  readonly children: ReactNode;
}

/** Something the person finished earlier, in one quiet line: a confirmed email, a saved bank account. */
export function DoneRow({ action, children }: DoneRowProps) {
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-sm bg-gray-50 px-3.5 py-2 text-[15px] font-semibold">
      <CircleCheck className="size-4.5 flex-none text-green-500" />
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {action}
    </div>
  );
}

/** The text for an error of the API. A step can say an invalid field in its own words. */
export function errorText(
  errors: Readonly<Record<string, string>>,
  code: string | undefined,
  invalid?: string,
): string | undefined {
  if (!code) {
    return undefined;
  }

  return code === 'VALIDATION_FAILED' && invalid ? invalid : (errors[code] ?? errors.UNKNOWN);
}

export function textOf(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === 'string' ? value.trim() : '';
}
