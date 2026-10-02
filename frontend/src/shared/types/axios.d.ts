import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuth?: boolean;
    _retry?: boolean;
    _authRevision?: number;
  }
}
