import { UserRole } from '../../modules/iam/users/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}
