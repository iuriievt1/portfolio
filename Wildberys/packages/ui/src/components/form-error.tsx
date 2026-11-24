/** What went wrong in a form, right above its button. Screen readers read it out when it appears. */
export function FormError({ children }: { readonly children: string }) {
  return (
    <p role="alert" className="mt-3 text-[13px] font-semibold text-red-500">
      {children}
    </p>
  );
}
