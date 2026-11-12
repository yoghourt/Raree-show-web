import { createClient } from "@supabase/supabase-js"
import { getFetchForGoogleGenerativeAI } from "@/lib/gemini-proxy-fetch"

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: getFetchForGoogleGenerativeAI(),
    },
  }
)
