'use client';

import type { CategorySection } from '@bluberi/api-client';
import { Checkbox } from '@bluberi/ui/components/checkbox';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { useState } from 'react';

import { choicesOf } from '../../registration/categories';

export interface CategoryPickerLabels {
  readonly label: string;
  /** Next to a section that is ticked as a whole. */
  readonly wholeSection: string;
  /** Next to a section ticked in part. Has the places {chosen} and {count}. */
  readonly partOfSection: string;
  /** What the arrow of a section opens, for screen readers. */
  readonly showSubcategories: string;
}

interface CategoryPickerProps {
  readonly sections: readonly CategorySection[];
  /** The ticked subcategories. A section that is not split is ticked by its own id. */
  readonly chosen: readonly string[];
  readonly labels: CategoryPickerLabels;
  readonly onChange: (chosen: string[]) => void;
}

/**
 * What a store sells. A tick on a section takes all of it. The arrow opens its subcategories
 * as a list of the same boxes, for a seller who sells only a part. One section is open
 * at a time, so the list stays short.
 */
export function CategoryPicker({ sections, chosen, labels, onChange }: CategoryPickerProps) {
  const [openId, setOpenId] = useState<string>();
  const ticked = new Set(chosen);

  function set(ids: readonly string[], on: boolean): void {
    const next = new Set(ticked);

    for (const id of ids) {
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
    }

    onChange([...next]);
  }

  return (
    <fieldset className="flex flex-col">
      <legend className="mb-1.75 text-[13px] font-bold text-gray-700">{labels.label}</legend>
      <ul className="overflow-hidden rounded-md border-[1.5px] border-gray-300">
        {sections.map((section) => {
          const choices = choicesOf(section);
          const count = choices.filter((id) => ticked.has(id)).length;
          const whole = count === choices.length;
          const part = count > 0 && !whole;
          const open = openId === section.id;
          const split = section.subcategories.length > 0;

          return (
            <li key={section.id} className="border-b border-gray-200 last:border-b-0">
              <div
                className={`flex items-stretch transition-colors ${open ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={whole ? true : part ? 'mixed' : false}
                  className="group flex min-h-13 flex-1 cursor-pointer items-center gap-3 px-3.5 text-left outline-none"
                  onClick={() => {
                    set(choices, !whole);
                  }}
                >
                  <span
                    className={`flex size-5 flex-none items-center justify-center rounded-xs border-[1.8px] transition-colors group-focus-visible:ring-4 group-focus-visible:ring-berry-500/14 [&_svg]:size-3.5 [&_svg]:stroke-3 ${
                      count > 0
                        ? 'border-berry-500 bg-berry-500 text-white'
                        : 'border-gray-300 bg-white group-hover:border-berry-300'
                    }`}
                  >
                    {whole ? <Check /> : part ? <Minus /> : null}
                  </span>
                  <span className="flex-1 text-[15px] font-bold text-berry-950">
                    {section.name}
                  </span>
                  {count > 0 ? (
                    <span className="text-xs font-bold whitespace-nowrap text-berry-600">
                      {whole
                        ? labels.wholeSection
                        : labels.partOfSection
                            .replace('{chosen}', String(count))
                            .replace('{count}', String(choices.length))}
                    </span>
                  ) : null}
                </button>
                {split ? (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={`${labels.showSubcategories}: ${section.name}`}
                    className="flex w-12 flex-none cursor-pointer items-center justify-center border-l border-gray-200 text-gray-400 transition-colors outline-none hover:text-berry-600 focus-visible:bg-berry-50 focus-visible:text-berry-600 [&_svg]:size-4.5"
                    onClick={() => {
                      setOpenId(open ? undefined : section.id);
                    }}
                  >
                    <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                ) : null}
              </div>
              {open ? (
                <ul className="grid animate-step-in gap-x-5 border-t border-gray-200 bg-gray-50 px-3.5 py-2.5 sm:grid-cols-2">
                  {section.subcategories.map((subcategory) => (
                    <li key={subcategory.id}>
                      <Checkbox
                        className="items-center py-1.75"
                        label={
                          <span className="text-sm font-semibold text-berry-950">
                            {subcategory.name}
                          </span>
                        }
                        checked={ticked.has(subcategory.id)}
                        onChange={(event) => {
                          set([subcategory.id], event.target.checked);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
