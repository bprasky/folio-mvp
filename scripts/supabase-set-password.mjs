import { createClient } from "@supabase/supabase-js";

const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [userId, newPassword] = process.argv.slice(2);

if (!url || !service) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!userId || !newPassword) {
  console.error("Usage: node scripts/supabase-set-password.mjs <userId> <newPassword>");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });

try {
  const { data, error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw error;
  console.log("OK — password updated for:", data.user?.email ?? userId);
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
}
