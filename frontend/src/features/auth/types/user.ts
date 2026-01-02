export type Role = 'admin' | 'agent' | 'user';

export type User = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role: Role;
  provider: 'local' | 'google';
  avatarUrl?: string;
  verified: boolean;
  status: 'pending' | 'active' | 'banned';
};
