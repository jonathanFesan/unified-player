import { create } from "zustand";
import { getCurrentUser } from "@/lib/spotify/api";
import { clearSpotifySession, hasSpotifySession, redirectToSpotifyLogin } from "@/lib/spotify/auth";
import type { SpotifyUser } from "@/types";

type AuthStatus = "loading" | "anonymous" | "authenticated" | "error";

interface AuthState {
  status: AuthStatus;
  user: SpotifyUser | null;
  isPremium: boolean;
  error: string | null;
  /** Estado do Web Playback SDK (apenas Premium) */
  sdkReady: boolean;
  init: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => void;
  setSdkReady: (ready: boolean) => void;
  /** Chamado quando o SDK retorna `account_error` (conta não-Premium) */
  markNotPremium: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: "loading",
  user: null,
  isPremium: false,
  error: null,
  sdkReady: false,

  init: async () => {
    if (!hasSpotifySession()) {
      set({ status: "anonymous", user: null, isPremium: false });
      return;
    }
    try {
      const user = await getCurrentUser();
      set({ status: "authenticated", user, isPremium: user.product === "premium", error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // 401 = sessão inválida → volta para anônimo
      if ((e as { status?: number }).status === 401) {
        clearSpotifySession();
        set({ status: "anonymous", user: null, isPremium: false });
      } else {
        set({ status: "error", error: message });
      }
    }
  },

  login: () => redirectToSpotifyLogin(),

  logout: () => {
    clearSpotifySession();
    set({ status: "anonymous", user: null, isPremium: false, sdkReady: false });
  },

  setSdkReady: (sdkReady) => set({ sdkReady }),
  markNotPremium: () => set({ isPremium: false, sdkReady: false }),
}));
