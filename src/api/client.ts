import axios from 'axios';

// Create axios instance with base URL
const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080', // Use Configure env var or fallback
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the auth token
client.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('linqAuthToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`; // Adjust prefix if backend expects something else
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle auth errors
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            if (error.response.status === 401) {
                // Clear token and redirect to onboarding if unauthorized
                localStorage.removeItem('linqAuthToken');
                localStorage.removeItem('linqUser');
                if (!window.location.pathname.includes('/onboarding')) {
                    window.location.href = '/onboarding';
                }
            } else if (error.response.status === 403) {
                // Forbidden (Banned) - Clear session and redirect
                localStorage.removeItem('linqAuthToken');
                localStorage.removeItem('linqUser');
                // Optional: You could redirect to a specific /banned page if you wanted, 
                // but for now onboarding with the error message is fine.
                // Only redirect if NOT already on onboarding page to allow UI to show error
                if (!window.location.pathname.includes('/onboarding')) {
                    window.location.href = '/onboarding';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default client;
