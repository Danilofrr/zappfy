/**
 * Política única de força de senha para todo o app.
 * - Mínimo 8 caracteres
 * - Máximo 72 (limite do bcrypt)
 * - Pelo menos uma letra E um dígito
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordCheck = { ok: true } | { ok: false; error: string };

export function validatePassword(pwd: string): PasswordCheck {
  if (typeof pwd !== "string" || pwd.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres` };
  }
  if (pwd.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres` };
  }
  if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) {
    return { ok: false, error: "A senha deve conter ao menos uma letra e um número" };
  }
  return { ok: true };
}

export const PASSWORD_HINT = `Use ao menos ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`;
