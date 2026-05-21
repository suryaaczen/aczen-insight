import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValid =
  typeof url === "string" &&
  /^https?:\/\//.test(url) &&
  typeof anonKey === "string" &&
  anonKey.length > 0;

if (!isValid) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing/invalid. Restart `npm run dev` after editing .env.local. Chat will fail until this is set.",
  );
}

// Use a harmless placeholder so createClient doesn't throw at module load.
// Actual calls will fail with a clearer error in streamChat() when CHAT_FN_URL is empty.
export const supabase = createClient(
  isValid ? url : "https://placeholder.supabase.co",
  isValid ? anonKey : "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);

export const SUPABASE_URL = isValid ? url : "";
