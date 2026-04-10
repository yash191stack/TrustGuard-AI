const API_BASE = 'http://localhost:5001/api';

export const analyzeText = async (text) => {
  const res = await fetch(`${API_BASE}/analyze/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('Analysis failed');
  return res.json();
};

export const analyzeURL = async (url) => {
  const res = await fetch(`${API_BASE}/analyze/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!res.ok) throw new Error('Analysis failed');
  return res.json();
};

export const analyzeAudio = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/analyze/audio`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Analysis failed');
  return res.json();
};

export const analyzeImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/analyze/image`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Analysis failed');
  return res.json();
};

export const analyzeDocument = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/analyze/document`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Analysis failed');
  return res.json();
};

export const analyzeVideo = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/analyze/video`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Analysis failed');
  return res.json();
};

export const getStats = async () => {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
};

export const getHistory = async () => {
  const res = await fetch(`${API_BASE}/analyze/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
};

export const healthCheck = async () => {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Server not reachable');
  return res.json();
};
