import { IsEnum } from 'class-validator';
import { UserStatus } from '../user.entity';

export class SetStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
