// Custom fetcher that injects the JWT token from localStorage
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("chat_token");
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errorData = await response.json();
      errorMsg = errorData.message || errorMsg;
    } catch (e) {
      // Ignore json parse error
    }
    
    // If unauthorized, clear token to force re-login
    if (response.status === 401) {
      localStorage.removeItem("chat_token");
      window.dispatchEvent(new Event("auth-unauthorized"));
    }
    
    throw new Error(errorMsg);
  }

  // Handle 204 No Content
  if (response.status === 204) return null;
  
  return response.json();
}
