import { createClient } from "@supabase/supabase-js";

const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Usage: node scripts/supabase-reset-or-create.mjs <email> <newPassword>
const [email, newPassword] = process.argv.slice(2);

if (!url || !service) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!email || !newPassword) {
  console.error("Usage: node scripts/supabase-reset-or-create.mjs <email> <newPassword>");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });

async function findUserByEmail(email) {
  // list users and filter by email (paginate if needed)
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(u => (u.email || "").toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

try {
  let user = await findUserByEmail(email);

  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (error) throw error;
    console.log("OK — password updated for:", data.user?.email, "authUserId:", data.user?.id);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: newPassword,
      email_confirm: true,
      user_metadata: { seeded: true }
    });
    if (error) throw error;
    console.log("OK — user created:", data.user?.email, "authUserId:", data.user?.id);
    console.log("NOTE: If your app expects profile.id === auth.users.id, you may need to update your app DB to this new id.");
  }
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
}
