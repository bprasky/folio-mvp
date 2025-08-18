// API utility functions
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function apiGet(endpoint: string) {
  return apiRequest(endpoint, { method: 'GET' });
}

export async function apiPost(endpoint: string, data: any) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiPut(endpoint: string, data: any) {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiDelete(endpoint: string) {
  return apiRequest(endpoint, { method: 'DELETE' });
} 