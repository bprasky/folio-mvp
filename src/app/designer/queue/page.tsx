import { redirect } from 'next/navigation';

/** Preserve existing queue notifications and bookmarks in the shared workspace. */
export default function EditorialQueuePage() {
  redirect('/designer/studio?view=editorial');
}
