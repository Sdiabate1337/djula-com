const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function fetchFromBackend(path: string, options: FetchOptions = {}) {
  // Ajouter le token d'authentification si disponible
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });
}