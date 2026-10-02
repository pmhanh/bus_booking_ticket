import { IsEnum } from 'class-validator';
import { UserRole } from '../user.entity';

export class SetRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
