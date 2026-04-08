// API base URL — set VITE_API_URL in .env for production
// Development default: direct connection to local backend
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8010'
