import { useState } from 'react';
import { Text, useInput } from 'ink';
import { safeText } from '../actions.js';
export function Input({
  active = true,
  initial = '',
  secret = false,
  submit,
}: {
  active?: boolean;
  initial?: string;
  secret?: boolean;
  submit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial),
    [cursor, setCursor] = useState(initial.length);
  useInput(
    (input, key) => {
      if (key.ctrl && input === 'u') {
        setValue('');
        setCursor(0);
        return;
      }
      if (key.ctrl || key.meta || key.escape || key.tab) return;
      if (key.return) {
        submit(value);
        return;
      }
      if (key.leftArrow) {
        setCursor(Math.max(0, cursor - 1));
        return;
      }
      if (key.rightArrow) {
        setCursor(Math.min(value.length, cursor + 1));
        return;
      }
      if (key.home) {
        setCursor(0);
        return;
      }
      if (key.end) {
        setCursor(value.length);
        return;
      }
      if (key.backspace) {
        if (cursor) {
          setValue(value.slice(0, cursor - 1) + value.slice(cursor));
          setCursor(cursor - 1);
        }
        return;
      }
      if (key.delete) {
        setValue(value.slice(0, cursor) + value.slice(cursor + 1));
        return;
      }
      if (key.upArrow || key.downArrow) return;
      const clean = safeText(input).replace(/[\n\t]/g, '');
      setValue(value.slice(0, cursor) + clean + value.slice(cursor));
      setCursor(cursor + clean.length);
    },
    { isActive: active },
  );
  const shown = secret ? '•'.repeat(value.length) : value;
  return (
    <Text>
      {shown.slice(0, cursor)}
      <Text inverse>{shown[cursor] ?? ' '}</Text>
      {shown.slice(cursor + 1)}
    </Text>
  );
}
