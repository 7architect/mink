import { useState } from 'react';
import { parameterFields, parseParameter, resolveValues } from '@mink/core';
import { parameterOptions, type CommandEntry, type Values } from '../model/commands.js';
export function useParameterForm(
  entry: CommandEntry,
  initial: Values,
  onComplete: (values: Values) => void,
) {
  const [values, setValues] = useState(initial),
    [field, setField] = useState(0),
    [choice, setChoice] = useState<number>(),
    [error, setError] = useState('');
  const fields = parameterFields(entry, values),
    current = fields[field];
  const options = current ? parameterOptions(current[1]) : [];
  const selectedChoice =
    choice ??
    Math.max(
      0,
      options.indexOf(String(current ? (values[current[0]] ?? current[1].default ?? '') : '')),
    );
  function submit(text: string) {
    if (!current) return;
    try {
      const input = { ...values, [current[0]]: parseParameter(current[1], text) };
      const visible = new Set(parameterFields(entry, input).map(([name]) => name));
      const next = Object.fromEntries(Object.entries(input).filter(([name]) => visible.has(name)));
      setValues(next);
      setError('');
      setChoice(undefined);
      if (field + 1 < parameterFields(entry, next).length) setField((index) => index + 1);
      else {
        resolveValues(entry, next);
        onComplete(next);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }
  return {
    fields,
    field,
    current,
    values,
    options,
    selectedChoice,
    error,
    submit,
    previous() {
      setField((index) => Math.max(0, index - 1));
      setChoice(undefined);
      setError('');
    },
    choose(direction: number) {
      setChoice(
        (value) => ((value ?? selectedChoice) + direction + options.length) % options.length,
      );
    },
  };
}
