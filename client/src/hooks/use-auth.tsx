import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiFetch } from "@/lib/api-client";
import { useLocation } from "wouter";
import { useEffect } from "react";
import type { LoginInput, RegisterInput } from "@shared/routes";

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Listen for global unauthorized events to redirect
  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.setQueryData([api.auth.me.path], null);
      setLocation("/login");
    };
    window.addEventListener("auth-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth-unauthorized", handleUnauthorized);
  }, [setLocation, queryClient]);

  const { data: user, isLoading, error } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      if (!localStorage.getItem("chat_token")) return null;
      try {
        const data = await apiFetch(api.auth.me.path);
        return api.auth.me.responses[200].parse(data);
      } catch (err) {
        return null;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginInput) => {
      const validated = api.auth.login.input.parse(data);
      const res = await apiFetch(api.auth.login.path, {
        method: api.auth.login.method,
        body: JSON.stringify(validated),
      });
      return api.auth.login.responses[200].parse(res);
    },
    onSuccess: (data) => {
      localStorage.setItem("chat_token", data.token);
      queryClient.setQueryData([api.auth.me.path], data.user);
      setLocation("/");
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterInput) => {
      const validated = api.auth.register.input.parse(data);
      const res = await apiFetch(api.auth.register.path, {
        method: api.auth.register.method,
        body: JSON.stringify(validated),
      });
      return api.auth.register.responses[201].parse(res);
    },
    onSuccess: (data) => {
      localStorage.setItem("chat_token", data.token);
      queryClient.setQueryData([api.auth.me.path], data.user);
      setLocation("/");
    },
  });

  const logout = () => {
    localStorage.removeItem("chat_token");
    queryClient.setQueryData([api.auth.me.path], null);
    queryClient.clear();
    setLocation("/login");
  };

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    logout,
  };
}
