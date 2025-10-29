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
  "Hasło musi mieć co najmniej 8 znaków, zawierać dużą i małą literę oraz cyfrę.";
