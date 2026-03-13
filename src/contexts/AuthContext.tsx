import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type Profile = {
  id: string;
  user_id: string;
  org_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileLoading: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const PROFILE_TIMEOUT_MS = 10000;
const AUTH_INIT_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const fetchProfile = async (userId: string) => {
    setProfileLoading(true);

    try {
      const result = await Promise.race([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error("PROFILE_TIMEOUT") }), PROFILE_TIMEOUT_MS),
        ),
      ]);

      if (result.error) {
        console.error("Erro ao buscar perfil:", result.error.message);
        setProfile(null);
        return;
      }

      setProfile(result.data);
    } catch (error) {
      console.error("Falha inesperada ao buscar perfil:", error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    const authInitTimeout = setTimeout(() => {
      if (!isActive) return;
      console.warn("Auth init timeout: liberando loading para evitar travamento.");
      setLoading(false);
      setProfileLoading(false);
      setInitialized(true);
    }, AUTH_INIT_TIMEOUT_MS);

    // Only process session once via getSession; onAuthStateChange handles subsequent changes
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession } }) => {
        if (!isActive) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
        }

        if (isActive) {
          setLoading(false);
          setInitialized(true);
        }
      })
      .catch((error) => {
        console.error("Erro ao carregar sessão:", error);
        if (!isActive) return;
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        setProfileLoading(false);
        setInitialized(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isActive || !initialized) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await fetchProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      isActive = false;
      clearTimeout(authInitTimeout);
      subscription.unsubscribe();
    };
  }, [initialized]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, profileLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
