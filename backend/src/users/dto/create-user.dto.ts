import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_MESSAGE =
  'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ thường, chữ hoa và số.';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}
