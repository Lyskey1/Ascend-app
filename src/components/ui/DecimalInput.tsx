import { useState } from 'react';
import { DECIMAL_INPUT_PATTERN, parseDecimalInput } from '@/lib/decimal';

// Mobile-safe decimal text input.
//
// The reason this needs to exist: a controlled <input type="number"> blocks
// the comma key on iOS, and a controlled <input type="text" inputMode="decimal">
// bound *directly* to a number prop swallows the comma too — `onChange` parses
// "17," to 17, the parent re-renders with value=17, and the input snaps back
// before the user can type the digit after the comma.
//
// We hold the raw textual value in local state and only emit parsed numbers
// to the parent. External numeric updates resync the text only when they
// don't match what's currently in the box, so prop-driven changes still win.

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null | undefined;
  onChange: (next: number | null) => void;
};

export function DecimalInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState<string>(() => (value == null ? '' : String(value)));
  // Track the last `value` we synced from so we can resync when an external
  // change arrives. This follows React's "adjusting state on prop change"
  // pattern and avoids a useEffect for prop->state sync.
  const [lastSyncedValue, setLastSyncedValue] = useState<number | null | undefined>(value);

  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    if (value == null) {
      if (text !== '') setText('');
    } else {
      const parsed = parseDecimalInput(text);
      if (Number.isNaN(parsed) || parsed !== value) {
        setText(String(value));
      }
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern={DECIMAL_INPUT_PATTERN}
      value={text}
      onChange={(e) => {
        // Allow only digits and one separator; we keep both "." and "," in the
        // displayed text so the user actually sees the comma they tapped.
        const sanitized = e.target.value.replace(/[^0-9.,]/g, '');
        setText(sanitized);
        if (sanitized === '' || /^[.,]+$/.test(sanitized)) {
          onChange(null);
          return;
        }
        const n = parseDecimalInput(sanitized);
        onChange(Number.isNaN(n) ? null : n);
      }}
      {...rest}
    />
  );
}
