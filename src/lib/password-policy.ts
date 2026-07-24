export interface PasswordRequirement {
  key: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { key: 'length',  label: 'At least 8 characters',    test: (p) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter',      test: (p) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter',      test: (p) => /[a-z]/.test(p) },
  { key: 'digit',   label: 'One number',                test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character',     test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Returns null when the password satisfies every requirement, otherwise a summary message. */
export function passwordStrengthError(password: string): string | null {
  const failed = PASSWORD_REQUIREMENTS.filter((r) => !r.test(password));
  if (failed.length === 0) return null;
  return `Password must include ${failed.map((r) => r.label.toLowerCase()).join(', ')}.`;
}
