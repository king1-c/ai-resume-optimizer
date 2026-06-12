import client from './client';

export const register = (data: {
  username: string;
  password: string;
}) => client.post('/auth/register', data).then((r) => r.data.data);

export const login = (data: { username: string; password: string }) =>
  client.post('/auth/login', data).then((r) => r.data.data);
