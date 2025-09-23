// API Configuration
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://vaultseed-api.railway.app/api'  // Your deployed backend URL
  : 'http://localhost:3001/api';

export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: `${API_BASE_URL}/auth/register`,
    LOGIN: `${API_BASE_URL}/auth/login`,
    VERIFY_SECURITY: `${API_BASE_URL}/auth/verify-security`,
  },
  VAULT: {
    GET: `${API_BASE_URL}/vault`,
    SAVE: `${API_BASE_URL}/vault`,
    EXPORT: `${API_BASE_URL}/vault/export`,
    DELETE: `${API_BASE_URL}/vault`,
  }
};

export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('vaultseed_token');
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
};