import { SUPABASE_URL } from "./supabase";

export const API_BASE_URL = SUPABASE_URL;

export const CHAT_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/chat` : "";

export const FINANCE_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/finance` : "";

export const MEDIA_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/media` : "";
