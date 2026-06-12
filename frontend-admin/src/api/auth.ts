import client from './client';

export const login = (data: { username: string; password: string }) =>
  client.post('/auth/admin/login', data).then((r) => r.data.data);
