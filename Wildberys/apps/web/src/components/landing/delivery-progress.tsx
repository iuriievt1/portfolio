/** How far a delivery has got, as a line that fills up. */
export function DeliveryProgress() {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-gray-200">
      <span className="block h-full w-[68%] rounded-full bg-brand" />
    </span>
  );
}
