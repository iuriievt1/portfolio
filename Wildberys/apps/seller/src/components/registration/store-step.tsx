'use client';

import type { CategorySection, RegistrationStore } from '@bluberi/api-client';
import { initials } from '@bluberi/ui/components/avatar';
import { buttonClasses } from '@bluberi/ui/components/button';
import { Checkbox } from '@bluberi/ui/components/checkbox';
import { Form } from '@bluberi/ui/components/form';
import { FormError } from '@bluberi/ui/components/form-error';
import { TextField } from '@bluberi/ui/components/text-field';
import type { ActionResult } from '@bluberi/web-auth/action-result';
import { ArrowLeft, Check, Store, Upload } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { postalCodeOf, type PostalAddress } from '../../registration/address';
import { toChoices } from '../../registration/categories';
import { useRegistrationDraft } from '../../registration/draft';
import { logoFormats, logoMaxBytes, type StoreLogo } from '../../registration/logo';
import { AddressFields, type AddressLabels } from './address-fields';
import { CategoryPicker } from './category-picker';
import { LogoCropper } from './logo-cropper';
import { errorText, secondaryLink, StepFrame, SubmitButton, textOf } from './step-frame';

/** Shown in place of an error of the API when the person goes on without a category. */
const nothingChosen = 'NOTHING_CHOSEN';

export interface StoreStepLabels extends AddressLabels {
  readonly title: string;
  readonly text: string;
  readonly uploadLogo: string;
  readonly changeLogo: string;
  readonly logoHint: string;
  readonly logoTitle: string;
  readonly logoText: string;
  readonly logoZoom: string;
  readonly logoUse: string;
  readonly close: string;
  readonly nameLabel: string;
  readonly categoriesLabel: string;
  readonly wholeSection: string;
  readonly partOfSection: string;
  readonly showSubcategories: string;
  readonly noCategories: string;
  readonly sameAsRegistered: string;
  /** The promise of the seller the Digital Services Act asks for. */
  readonly selfCertification: string;
  readonly invalidStore: string;
  readonly finish: string;
  readonly back: string;
}

interface StoreStepProps {
  /** The store of the draft, when this step was saved before. */
  readonly store: RegistrationStore | null;
  /** The category tree of the catalog. */
  readonly sections: readonly CategorySection[];
  /** The registered address of the company in one line. */
  readonly registeredAddress: string;
  /** The country of the seller. An address of its own for returned goods is in it too. */
  readonly countryCode: string;
  readonly labels: StoreStepLabels;
  /** Texts by the error code of the API. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  readonly backHref: Route;
  readonly doneHref: Route;
  /** Server action: uploads a picture for the logo. */
  readonly uploadLogo: (formData: FormData) => Promise<ActionResult<StoreLogo>>;
  /** Server action: saves the store and sends the registration to Bluberi. */
  readonly finish: (
    name: string,
    logoImageId: string | null,
    categoryIds: readonly string[],
    returnAddress: PostalAddress | null,
    selfCertified: boolean,
  ) => Promise<ActionResult>;
}

/**
 * Step 4 of the registration: the store as buyers will see it. Its logo and name, what it sells
 * and where goods come back. The button sends the whole registration.
 */
export function StoreStep({
  store,
  sections,
  registeredAddress,
  countryCode,
  labels,
  errors,
  backHref,
  doneHref,
  uploadLogo,
  finish,
}: StoreStepProps) {
  const router = useRouter();
  const [draft, keep] = useRegistrationDraft();
  const [ownAddress, setOwnAddress] = useState(store !== null && store.returnAddress !== null);
  const [selfCertified, setSelfCertified] = useState(false);
  // A picture the person chose and is cutting a logo out of.
  const [picture, setPicture] = useState<File | null>(null);
  const [errorCode, setErrorCode] = useState<string>();
  const [busy, startTransition] = useTransition();
  const name = draft.storeName ?? store?.name ?? '';
  const logo = draft.logo ?? store?.logo ?? null;
  const chosen = draft.categoryIds ?? toChoices(sections, store?.categoryIds ?? []);
  const error =
    errorCode === nothingChosen
      ? labels.noCategories
      : errorText(errors, errorCode, labels.invalidStore);

  function upload(square: Blob): void {
    startTransition(async () => {
      const form = new FormData();

      form.set('file', new File([square], 'logo.png', { type: square.type }));

      const result = await uploadLogo(form);

      if (result.ok) {
        setErrorCode(undefined);
        keep({ logo: result.value });
      } else {
        setErrorCode(result.code);
      }
    });
  }

  return (
    <StepFrame
      title={labels.title}
      text={labels.text}
      secondary={
        <Link href={backHref} className={secondaryLink}>
          <ArrowLeft />
          {labels.back}
        </Link>
      }
    >
      <Form
        className="flex flex-col gap-5"
        onChange={() => {
          setErrorCode(undefined);
        }}
        onFields={(formData) => {
          if (chosen.length === 0) {
            setErrorCode(nothingChosen);

            return;
          }

          startTransition(async () => {
            const result = await finish(
              name.trim(),
              logo?.imageId ?? null,
              chosen,
              ownAddress
                ? {
                    street: textOf(formData, 'street'),
                    city: textOf(formData, 'city'),
                    postalCode: postalCodeOf(countryCode, textOf(formData, 'postalCode')),
                  }
                : null,
              selfCertified,
            );

            if (result.ok) {
              keep({ storeName: undefined, logo: undefined, categoryIds: undefined });
              router.push(doneHref);
            } else {
              setErrorCode(result.code);
            }
          });
        }}
      >
        <div className="flex items-center gap-4">
          <span className="relative flex size-18 flex-none items-center justify-center overflow-hidden rounded-lg bg-pink text-2xl font-extrabold text-white [&_svg]:size-7">
            {logo ? (
              <Image src={logo.url} alt="" fill sizes="72px" unoptimized className="object-cover" />
            ) : name.trim() ? (
              initials(name)
            ) : (
              <Store />
            )}
          </span>
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            {/* A label around the file field: a click on the button opens the choice of a file. */}
            <label
              className={`cursor-pointer has-focus-visible:ring-4 has-focus-visible:ring-berry-500/14 ${buttonClasses({ size: 'sm', variant: 'soft' })} ${busy ? 'pointer-events-none opacity-60' : ''}`}
            >
              <Upload />
              {logo ? labels.changeLogo : labels.uploadLogo}
              <input
                type="file"
                accept={logoFormats}
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  // The same file can be chosen again, to cut it another way.
                  event.target.value = '';

                  if (file && file.size > logoMaxBytes) {
                    setErrorCode('IMAGE_TOO_LARGE');
                  } else if (file) {
                    setErrorCode(undefined);
                    setPicture(file);
                  }
                }}
              />
            </label>
            <span className="text-[12.5px] font-medium text-gray-600">{labels.logoHint}</span>
          </div>
        </div>

        <TextField
          label={labels.nameLabel}
          icon={<Store />}
          name="name"
          autoComplete="organization"
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(event) => {
            keep({ storeName: event.target.value });
          }}
        />

        <CategoryPicker
          sections={sections}
          chosen={chosen}
          labels={{
            label: labels.categoriesLabel,
            wholeSection: labels.wholeSection,
            partOfSection: labels.partOfSection,
            showSubcategories: labels.showSubcategories,
          }}
          onChange={(categoryIds) => {
            setErrorCode(undefined);
            keep({ categoryIds });
          }}
        />

        <div className="flex flex-col gap-1.5">
          <Checkbox
            label={
              <span className="text-[15px] font-bold text-berry-950">
                {labels.sameAsRegistered}
              </span>
            }
            checked={!ownAddress}
            onChange={(event) => {
              setOwnAddress(!event.target.checked);
            }}
          />
          {ownAddress ? null : (
            <span className="pl-7.5 text-[13px] font-medium text-gray-600">
              {registeredAddress}
            </span>
          )}
        </div>
        {ownAddress ? (
          <AddressFields countryCode={countryCode} labels={labels} address={store?.returnAddress} />
        ) : null}

        <Checkbox
          label={
            <span className="text-[13px] leading-normal font-semibold">
              {labels.selfCertification}
            </span>
          }
          required
          checked={selfCertified}
          onChange={(event) => {
            setSelfCertified(event.target.checked);
          }}
        />

        {error ? <FormError>{error}</FormError> : null}

        <SubmitButton busy={busy} variant="gradient" icon={<Check />}>
          {labels.finish}
        </SubmitButton>
      </Form>

      <LogoCropper
        file={picture}
        labels={{
          title: labels.logoTitle,
          text: labels.logoText,
          zoom: labels.logoZoom,
          use: labels.logoUse,
          close: labels.close,
        }}
        onCancel={() => {
          setPicture(null);
        }}
        onInvalid={() => {
          setPicture(null);
          setErrorCode('IMAGE_INVALID');
        }}
        onCrop={(square) => {
          setPicture(null);
          upload(square);
        }}
      />
    </StepFrame>
  );
}
