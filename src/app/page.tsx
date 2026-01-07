// src/app/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { redirect } from "next/navigation";
import MagazinePage from "@/components/magazine/MagazinePage";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const session = await getServerSession(authOptions);
  
  // If not logged in, redirect to auth page
  if (!session) {
    redirect("/auth");
  }
  
  // If logged in, show magazine
  return <MagazinePage editionSlug="for-you" />;
}