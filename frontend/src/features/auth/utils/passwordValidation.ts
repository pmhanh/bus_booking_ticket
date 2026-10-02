const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function validatePassword(password: string): string {
  if (!password.trim()) return 'Vui lòng nhập mật khẩu';
  if (!PASSWORD_PATTERN.test(password))
    return 'Mật khẩu cần tối thiểu 8 ký tự, có chữ thường, chữ hoa và số.';
  return '';
}

export function validateConfirm(password: string, confirm: string): string {
  if (!confirm.trim()) return 'Vui lòng nhập lại mật khẩu';
  if (password !== confirm) return 'Mật khẩu nhập lại không khớp';
  return '';
}
