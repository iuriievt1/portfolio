interface OptionBoxesProps<Value extends string> {
  /** What is being chosen. */
  readonly label: string;
  /** The name of the field in its form. */
  readonly name: string;
  readonly options: readonly { readonly value: Value; readonly label: string }[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
}

/** A choice between two options that both stay in sight: two equal boxes side by side. */
export function OptionBoxes<Value extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: OptionBoxesProps<Value>) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-bold text-gray-700">{label}</legend>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex h-12 cursor-pointer items-center justify-center rounded-sm border-[1.5px] px-2 text-center text-[15px] font-extrabold transition-colors has-focus-visible:ring-4 has-focus-visible:ring-berry-500/14 ${
              value === option.value
                ? 'border-berry-500 bg-berry-50 text-berry-600'
                : 'border-gray-300 bg-white hover:border-berry-300'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              className="sr-only"
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
