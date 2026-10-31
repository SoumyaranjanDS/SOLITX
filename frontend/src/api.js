import axios from "axios";
import { redirectToAuth } from "./utils/authRedirect";

const api = axios.create({
  // Use VITE_API_URL in development, but fallback to the relative path in production
  // This allows Nginx to seamlessly route /api/v1 to the backend via reverse proxy!
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach JWT token to every request automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to automatically purge invalid/stale tokens on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // For unauthorized mutations (POST, PUT, DELETE, PATCH), redirect to login with return path
      const method = (error.config?.method || "").toUpperCase();
      const isAuthRoute = error.config?.url?.includes("/auth/");
      if (!isAuthRoute && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        redirectToAuth();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
