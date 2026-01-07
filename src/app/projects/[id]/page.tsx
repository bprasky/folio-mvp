import { redirect } from 'next/navigation';

export default function LegacyProjectsDetail({ params }: { params: { id: string }}) {
  redirect(`/project/${params.id}`);
}
