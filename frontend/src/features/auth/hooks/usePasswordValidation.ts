const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const usePasswordValidation = () => {
  const validatePassword = (password: string) => {
    if (!password?.trim()) return 'Vui lòng nhập mật khẩu';
    if (!passwordRule.test(password))
      return 'Mật khẩu cần tối thiểu 8 ký tự, có chữ thường, chữ hoa và số.';
    return '';
  };

  const validateConfirm = (password: string, confirm: string) => {
    if (!confirm?.trim()) return 'Vui lòng nhập lại mật khẩu';
    if (password !== confirm) return 'Mật khẩu nhập lại không khớp';
    return '';
  };

  return { validatePassword, validateConfirm, passwordRule };
};
