import api from "./api.service";
import { captureCsrfToken, csrfHeader } from "@/lib/csrf";

// Raw-response screens retain their response format while sharing cookie,
// CSRF and expired-session recovery with the main API client.
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const execute = async () => {
        const headers = new Headers(init.headers);
        headers.set("X-Client-Type", "web");
        if (!/^(GET|HEAD|OPTIONS)$/i.test(init.method || "GET")) {
            Object.entries(csrfHeader()).forEach(([key, value]) => headers.set(key, value));
        }
        const response = await fetch(input, { ...init, credentials: "include", cache: "no-store", headers });
        captureCsrfToken(response);
        return response;
    };
    let response = await execute();
    if (response.status === 401) {
        const session = await api.get("/auth/me");
        if (session.success) response = await execute();
    }
    return response;
}
