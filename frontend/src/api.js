const API_URL = 'http://localhost:8000';

export const renderVideo = async (clips) => {
  const response = await fetch(`${API_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clips })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Render failed');
  }
  return response.json();
};

export const trackObject = async (videoPath, bbox) => {
  const response = await fetch(`${API_URL}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_path: videoPath, initial_bbox: bbox })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Tracking failed');
  }
  return response.json();
};

export const uploadMedia = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Upload failed');
  }
  return response.json();
};
