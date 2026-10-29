import axios from "axios";

export const SESSION_ENDED_EVENT = "auth:session-ended";

const api = axios.create({
    baseURL:
        import.meta.env.VITE_API_URL ||
        "http://localhost:5000/api",

    withCredentials: true,

    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.response.use(
    (response) => response,

    (error) => {
        // This device's session was signed out by a password change made
        // elsewhere; AuthProvider clears it and explains why.
        if (error.response?.data?.code === "PASSWORD_CHANGED") {
            window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
        }

        return Promise.reject(error);
    }
);

export default api;