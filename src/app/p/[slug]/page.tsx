import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/post/getPostBySlug";
import { ImmersiveProjectPage } from "@/components/project/ImmersiveProjectPage";

export default async function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  return <ImmersiveProjectPage post={post} modules={post.modules} />;
}

