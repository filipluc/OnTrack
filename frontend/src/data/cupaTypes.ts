export interface CupaMatch {
  time: string;
  /** Which pitch, when a day runs matches across more than one field in parallel. */
  field?: string;
  group: string;
  home: string;
  away: string;
}

export interface CupaDay {
  label: string;
  matches: CupaMatch[];
}
