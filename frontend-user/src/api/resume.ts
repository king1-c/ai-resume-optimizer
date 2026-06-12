import client from './client';

export const uploadResume = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return client
    .post('/resumes/upload', fd)
    .then((r) => r.data.data);
};

export const analyzeResume = (resumeId: number, targetPosition?: string, jobDescription?: string) =>
  client
    .post('/resumes/analyze', {
      resumeId,
      targetPosition,
      jobDescription,
    })
    .then((r) => r.data.data);

export async function* analyzeResumeStream(
  resumeId: number,
  targetPosition?: string,
  jobDescription?: string
): AsyncGenerator<any, void, unknown> {
  const response = await fetch('/api/resumes/analyze/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      resumeId,
      targetPosition,
      jobDescription,
    }),
  });

  if (!response.body) {
    throw new Error('无法获取响应流');
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`分析请求失败: ${response.status} ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;

      // SSE 格式：event: X\ndata: {...}
      // 我们只关心 data: 行
      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          yield data;
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}

export const getAnalysisDetail = (analysisId: number) =>
  client.get(`/resumes/analysis/${analysisId}`).then((r) => r.data.data);

export const getHistory = (page = 1, pageSize = 10) =>
  client
    .get('/resumes/history', { params: { page, pageSize } })
    .then((r) => r.data.data);

export const getResumes = (page = 1, pageSize = 10) =>
  client
    .get('/resumes/list', { params: { page, pageSize } })
    .then((r) => r.data.data);

export const getResumeAnalyses = (resumeId: number) =>
  client
    .get(`/resumes/${resumeId}/analyses`)
    .then((r) => r.data.data);

export const deleteResume = (resumeId: number) =>
  client.delete(`/resumes/${resumeId}`).then((r) => r.data);

export const downloadResume = async (resumeId: number) => {
  try {
    const res = await client.get(`/resumes/export/${resumeId}`, {
      responseType: 'blob',
      timeout: 30000,
    });

    let blob: Blob;

    // 检查响应是否为 JSON 错误（后端异常时可能返回 200 + JSON）
    const contentType = String(res.headers['content-type'] || '');
    if (contentType.includes('application/json')) {
      const text = await res.data.text();
      try {
        const json = JSON.parse(text);
        if (!json.success) {
          throw new Error(json.error || '导出失败');
        }
      } catch (parseErr: any) {
        if (parseErr.message !== '导出失败') {
          // JSON 解析失败，降级为下载原始内容
        }
      }
      blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    } else {
      blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'text/plain;charset=utf-8' });
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `优化简历_${resumeId}.txt`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 200);
  } catch (error: any) {
    let msg = '导出失败，请重试';

    if (error?.response?.data instanceof Blob) {
      try {
        const errText = await error.response.data.text();
        const errJson = JSON.parse(errText);
        msg = errJson.error || errJson.message || msg;
      } catch {
        // Blob 无法解析为 JSON，使用默认消息
      }
    } else if (error?.response?.data?.error) {
      msg = error.response.data.error;
    } else if (error?.message && error.message !== 'Network Error') {
      msg = error.message;
    }

    const { message } = await import('antd');
    message.error(msg);
  }
};
