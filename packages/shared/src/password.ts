/** Password policy (SRS BR-AUTH-003): at least 8 characters, one letter and one number. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordProblem = 'TOO_SHORT' | 'TOO_LONG' | 'NO_LETTER' | 'NO_NUMBER';

export function passwordProblems(password: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push('TOO_SHORT');
  if (password.length > PASSWORD_MAX_LENGTH) problems.push('TOO_LONG');
  if (!/\p{L}/u.test(password)) problems.push('NO_LETTER');
  if (!/\d/.test(password)) problems.push('NO_NUMBER');
  return problems;
}

export const isValidPassword = (password: string): boolean =>
  passwordProblems(password).length === 0;
