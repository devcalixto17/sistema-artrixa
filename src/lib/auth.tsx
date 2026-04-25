import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";

export type AppRole = "fundador" | "admin" | "usuario";

type AuthContextValue = {
  loading: boolean;
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  displayName: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, displayName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { displayName: null, roles: [] as AppRole[] };
  }

  const client = supabase as any;

  const [profileResult, rolesResult] = await Promise.all([
    client.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    client.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const roles = ((rolesResult.data as Array<{ role: string }> | null) ?? [])
    .map((item) => item.role)
    .filter((role): role is AppRole => role === "fundador" || role === "admin" || role === "usuario");

  return {
    displayName: (profileResult.data?.display_name as string | null | undefined) ?? null,
    roles,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const onSessionChanged = async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRoles([]);
        setDisplayName(null);
        setLoading(false);
        return;
      }

      const profile = await loadProfile(nextSession.user.id);
      setRoles(profile.roles);
      setDisplayName(profile.displayName);
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void onSessionChanged(nextSession);
    });

    void supabase.auth.getSession().then(({ data }) => {
      void onSessionChanged(data.session ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return "Configure a conexão com Supabase antes de entrar.";
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error?.message ?? null;
  };

  const signUp = async (email: string, password: string, nextDisplayName: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return "Configure a conexão com Supabase antes de cadastrar.";
    }

    const client = supabase as any;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });

    if (error) {
      return error.message;
    }

    if (data.user?.id) {
      await client.from("profiles").upsert({ id: data.user.id, display_name: nextDisplayName.trim() || null });

      if (data.user.identities && data.user.identities.length > 0) {
        await client
          .from("user_roles")
          .upsert({ user_id: data.user.id, role: "usuario" }, { onConflict: "user_id,role" });
      }
    }

    return null;
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      session,
      roles,
      displayName,
      signIn,
      signUp,
      signOut,
      hasRole: (role: AppRole) => roles.includes(role),
    }),
    [loading, user, session, roles, displayName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  }
  return context;
}