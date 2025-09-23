// API Configuration
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://vaultseedv2-production.up.railway.app/api'
  : 'http://localhost:3001/api';

// API endpoints
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
  },
  FEEDBACK: {
    SUBMIT: `${API_BASE_URL}/feedback`,
  }
};

// Generic API request function
export async function apiRequest(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('vaultseed_token');
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}
