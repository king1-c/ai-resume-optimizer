import client from './client';

export const getStats = () => client.get('/admin/dashboard').then((r) => r.data.data);

export const getUsers = (keyword = '', page = 1, pageSize = 20) =>
  client.get('/admin/users', { params: { keyword, page, pageSize } }).then((r) => r.data.data);

export const getUserDetail = (id: number) =>
  client.get(`/admin/users/${id}`).then((r) => r.data.data);

export const blockUser = (id: number) => client.post(`/admin/users/${id}/block`).then((r) => r.data);
export const unblockUser = (id: number) => client.post(`/admin/users/${id}/unblock`).then((r) => r.data);
export const deleteUser = (id: number) => client.delete(`/admin/users/${id}`).then((r) => r.data);

export const getResumes = (params: {
  keyword?: string;
  minScore?: number;
  maxScore?: number;
  page?: number;
  pageSize?: number;
} = {}) => client.get('/admin/resumes', { params }).then((r) => r.data.data);

export const getResumeDetail = (id: number) =>
  client.get(`/admin/resumes/${id}`).then((r) => r.data.data);

export const deleteResume = (id: number) =>
  client.delete(`/admin/resumes/${id}`).then((r) => r.data);

/** 获取简历预览数据（返回 blob URL，支持 iframe 加载） */
export const getResumePreviewUrl = async (id: number): Promise<string> => {
  const token = localStorage.getItem('admin_token');
  const resp = await fetch(`/api/resumes/preview/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error('加载预览失败');
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
};
