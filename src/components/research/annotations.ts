export type FieldKind = 'u8' | 'i8' | 'u16le' | 'i16le' | 'u32le' | 'temp' | 'ascii' | 'bits';

export interface Annotation {
  label: string;
  offset: number;
  kind: FieldKind;
  /** only for ascii */
  length?: number;
}

/** attribute id → user-defined byte fields of its payload */
export type Annotations = Record<number, Annotation[]>;

const KEY = 'pax3.annotations';

export const loadAnnotations = (): Annotations => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
};

export const saveAnnotations = (a: Annotations) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    // storage unavailable
  }
};

export const KIND_SIZE: Record<FieldKind, number> = { u8: 1, i8: 1, u16le: 2, i16le: 2, u32le: 4, temp: 2, ascii: 0, bits: 1 };
