import { redirect } from 'next/navigation';

// Redirect /homeowner to /individual for backward compatibility
export async function GET() {
  redirect('/individual');
}



