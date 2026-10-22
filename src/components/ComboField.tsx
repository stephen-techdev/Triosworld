/**
 * A text input that also offers suggestions.
 *
 * The admin product form used <select> for collection, fit, fabric and badge,
 * which meant the operator could only pick from a list written for a T-shirt
 * label. A "Boxy" fit, a "Linen Blend" fabric or a "Sold Out" badge simply had
 * nowhere to go.
 *
 * This is a plain text input with a <datalist> attached: the suggestions appear
 * as you type and can be ignored. Whatever the operator types is what is saved,
 * so the card shows their wording and not a substitute.
 */
import { useId } from 'react';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Offered as autocomplete. Optional — the field still accepts anything. */
  suggestions?: readonly string[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  maxLength?: number;
}

export default function ComboField({
  label, value, onChange, suggestions = [], placeholder, hint, required, maxLength,
}: Props) {
  const id = useId();
  const listId = `${id}-suggestions`;

  return (
    <label className="block">
      <span className="text-xs text-ink/60">{label}</span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        list={suggestions.length ? listId : undefined}
        autoComplete="off"
        className="mt-1.5 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:border-ink"
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
      {hint && <span className="text-[11px] text-ink/65">{hint}</span>}
    </label>
  );
}
