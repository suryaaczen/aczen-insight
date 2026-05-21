import { SUPABASE_URL } from "./supabase";

export const API_BASE_URL = SUPABASE_URL;

export const CHAT_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/chat` : "";
