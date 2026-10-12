import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

// Return a usable error for every auth failure, including thrown network errors.
const runAuthRequest = async (request: () => Promise<{ error: unknown }>) => {
  if (!isSupabaseConfigured) {
    return { error: new Error("Sign-in is unavailable because Supabase is not configured. Contact the site administrator.") };
  }
  try {
    const result = await request();
    if (result.error) throw result.error;
    return { error: null };
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Authentication failed. Please try again.";
    return { error: new Error(/failed to fetch|fetch failed|networkerror|network request failed/i.test(message)
      ? "Unable to connect to the sign-in service. Check your connection and try again."
      : message) };
  }
};

const configuredInactivityTimeout = Number(
  import.meta.env.VITE_AUTH_INACTIVITY_TIMEOUT_MS,
);
const inactivityLogoutDisabled = configuredInactivityTimeout === 0;
const authInactivityTimeout =
  Number.isFinite(configuredInactivityTimeout) &&
  configuredInactivityTimeout > 0
    ? configuredInactivityTimeout
    : 30 * 60 * 1000;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  linkGoogle: () => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    username: string,
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching user role:", error);
        return null;
      }

      return data?.role || null;
    } catch (error) {
      console.error("Error fetching user role:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fetch user role when user is authenticated
        setTimeout(async () => {
          const role = await fetchUserRole(session.user.id);
          setUserRole(role);
        }, 0);
      } else {
        setUserRole(null);
      }

      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user.id).then(setUserRole);
      }

      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user || inactivityLogoutDisabled) return;

    let inactivityTimer: ReturnType<typeof setTimeout>;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        void supabase.auth.signOut();
      }, authInactivityTimeout);
    };
    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, resetInactivityTimer, {
        passive: true,
      }),
    );
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, resetInactivityTimer),
      );
    };
  }, [session?.user]);

  const signIn = (identifier: string, password: string) => runAuthRequest(async () => {
    let email = identifier.trim();
    if (!email.includes("@")) {
      const { data, error } = await supabase.rpc("get_email_by_username", {
        username_input: email.toLowerCase(),
      });
      if (error) return { error };
      if (typeof data !== "string" || !data) {
        return { error: new Error("Invalid username or password") };
      }
      email = data;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  });

  const signInWithGoogle = () => runAuthRequest(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  });

  const linkGoogle = () => runAuthRequest(async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/profile/${user?.id}/edit`,
      },
    });
    return { error };
  });

  const signUp = (
    email: string,
    password: string,
    fullName: string,
    username: string,
  ) => runAuthRequest(async () => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
          username: username.trim().toLowerCase(),
        },
      },
    });
    return { error };
  });

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    userRole,
    loading,
    signIn,
    signInWithGoogle,
    linkGoogle,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
