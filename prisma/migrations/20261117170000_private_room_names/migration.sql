-- Private per-account autocomplete names; no shared or public vocabulary writes.
CREATE TABLE IF NOT EXISTS "user_room_names" (
    "userId" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_room_names_pkey" PRIMARY KEY ("userId", "normalizedName"),
    CONSTRAINT "user_room_names_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Access is through authenticated server routes; no anonymous Supabase access.
ALTER TABLE "user_room_names" ENABLE ROW LEVEL SECURITY;
