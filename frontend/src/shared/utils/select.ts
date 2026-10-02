import type { CSSProperties } from 'react';

export const optionTextStyle: CSSProperties = { color: '#111' };
export const placeholderOptionStyle: CSSProperties = { color: '#666' };

export const parseSelectNumber = (value: string): number | '' => {
  if (value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
};
