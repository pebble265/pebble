/** Hand-off between the Terms sheet and the Create Account screen. */
export const termsFlow = {
  /** set by the sheet: true = Agree, false = Disagree, null = closed without choosing */
  answer: null as boolean | null,
  /** Create was pressed before agreeing: continue right after Agree */
  continueCreate: false,
};
