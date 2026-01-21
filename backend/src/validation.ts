const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
};

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isPasswordStrong(password: string): boolean {
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return false;
  }

  return PASSWORD_REQUIREMENTS.pattern.test(password);
}

export const PASSWORD_REQUIREMENTS_DESCRIPTION =
  "The password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, and a number.";
