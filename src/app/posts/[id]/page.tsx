"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Heart, Share2, MessageCircle, Tag } from "lucide-react";
import SafeImage from "@/components/SafeImage";

interface PostItem {
  id: string;
  productName: string;
  imageUrl?: string | null;
  affiliateUrl?: string | null;
  section?: string | null;
}

interface Post {
  id: string;
  title: string;
  content?: string | null;
  createdAt: Date;
  designer: {
    id: string;
    name: string;
    profileImage?: string | null;
  };
  items: PostItem[];
}

export default function PostViewPage() {
  const params = useParams();
  const postId = params.id as string;
  
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!postId) return;

    const loadPost = async () => {
      try {
        const response = await fetch(`/api/posts/${postId}`);
        if (response.ok) {
          const data = await response.json();
          setPost(data.post);
        } else {
          toast.error("Failed to load post");
        }
      } catch (error) {
        console.error("Error loading post:", error);
        toast.error("Failed to load post");
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId]);

  const handleLike = () => {
    setLiked(!liked);
    // In a real app, you'd make an API call here
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: post?.title || "Check out this post",
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleProductClick = (item: PostItem) => {
    if (item.affiliateUrl) {
      window.open(item.affiliateUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-canvas p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-surface-ground rounded-lg w-2/3 mb-6"></div>
            <div className="h-6 bg-surface-ground rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-surface-ground rounded-xl h-64"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-surface-canvas p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="folio-h2 mb-4">Post not found</h1>
          <p className="folio-body">The post you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Hero Section */}
      <div className="ridge-card mx-4 mt-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="folio-h1 mb-4">{post.title}</h1>

            {post.content && (
              <p className="folio-body text-lg mb-6 max-w-2xl mx-auto">
                {post.content}
              </p>
            )}

            {/* Designer Info */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-surface-ground overflow-hidden">
                {post.designer.profileImage ? (
                  <SafeImage
                    src={post.designer.profileImage}
                    alt={post.designer.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-ground flex items-center justify-center">
                    <span className="text-folio-text-secondary font-medium text-lg">
                      {post.designer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-left">
                <p className="folio-ui text-folio-text-primary">{post.designer.name}</p>
                <p className="folio-meta">
                  {new Date(post.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleLike}
                className={`ridge-btn flex items-center gap-2 px-4 py-2 transition-colors ${
                  liked
                    ? "bg-red-100 text-red-600"
                    : ""
                }`}
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
                {liked ? "Liked" : "Like"}
              </button>

              <button
                onClick={handleShare}
                className="ridge-btn flex items-center gap-2 px-4 py-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>

              <button className="ridge-btn flex items-center gap-2 px-4 py-2">
                <MessageCircle className="w-4 h-4" />
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="folio-h2 mb-8 text-center">
          Featured Products ({post.items.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {post.items.map((item) => (
            <div
              key={item.id}
              className="group ridge-card hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer overflow-hidden"
              onClick={() => handleProductClick(item)}
            >
              {/* Product Image */}
              <div className="relative h-48 bg-surface-ground overflow-hidden">
                <SafeImage
                  src={item.imageUrl || "/images/product-placeholder.jpg"}
                  alt={item.productName}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Section Badge */}
                {item.section && (
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-canvas/90 backdrop-blur-sm folio-meta text-folio-text-secondary">
                      <Tag className="w-3 h-3" />
                      {item.section}
                    </span>
                  </div>
                )}

                {/* External Link Indicator */}
                {item.affiliateUrl && (
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--accent)] text-white folio-meta font-medium">
                      <ExternalLink className="w-3 h-3" />
                      Shop Now
                    </span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="folio-ui text-folio-text-primary mb-2 line-clamp-2">
                  {item.productName}
                </h3>

                {item.affiliateUrl && (
                  <div className="flex items-center justify-between">
                    <span className="folio-meta text-[var(--accent)] font-medium">
                      Click to shop
                    </span>
                    <ExternalLink className="w-4 h-4 text-folio-text-tertiary" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {post.items.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-surface-ground rounded-full mx-auto mb-4 flex items-center justify-center">
              <Tag className="w-8 h-8 text-folio-text-tertiary" />
            </div>
            <h3 className="folio-h3 mb-2">No products yet</h3>
            <p className="folio-body">This post doesn't have any products yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
