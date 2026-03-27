import { apiUrl } from "@/url";

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem("token");
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
};

export const apiFetch = async <T = any>(endpoint: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    console.error("Unauthorized access");
    throw new Error("Unauthorized");
  }

  if (!res.ok) throw new Error(`API error: ${res.status}`);

  return res.json();
};

export const fetchProducts = (dealerId: string) =>
  apiFetch<any[]>(`/products?dealerid=${dealerId}`);

export const fetchRetailerOrders = (retailerId: string) =>
  apiFetch<any[]>(`/orders?retailerId=${retailerId}`);