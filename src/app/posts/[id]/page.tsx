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
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded-lg w-2/3 mb-6"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-xl h-64"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Post not found</h1>
          <p className="text-gray-500">The post you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
            
            {post.content && (
              <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
                {post.content}
              </p>
            )}

            {/* Designer Info */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                {post.designer.profileImage ? (
                  <SafeImage
                    src={post.designer.profileImage}
                    alt={post.designer.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-600 font-medium text-lg">
                      {post.designer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">{post.designer.name}</p>
                <p className="text-sm text-gray-500">
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
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                  liked 
                    ? "bg-red-100 text-red-600" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
                {liked ? "Liked" : "Like"}
              </button>

              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>

              <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">
                <MessageCircle className="w-4 h-4" />
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          Featured Products ({post.items.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {post.items.map((item) => (
            <div
              key={item.id}
              className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer overflow-hidden"
              onClick={() => handleProductClick(item)}
            >
              {/* Product Image */}
              <div className="relative h-48 bg-gray-100 overflow-hidden">
                <SafeImage
                  src={item.imageUrl || "/images/product-placeholder.jpg"}
                  alt={item.productName}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Section Badge */}
                {item.section && (
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-700">
                      <Tag className="w-3 h-3" />
                      {item.section}
                    </span>
                  </div>
                )}

                {/* External Link Indicator */}
                {item.affiliateUrl && (
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-600 text-white text-xs font-medium">
                      <ExternalLink className="w-3 h-3" />
                      Shop Now
                    </span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                  {item.productName}
                </h3>
                
                {item.affiliateUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-600 font-medium">
                      Click to shop
                    </span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {post.items.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Tag className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products yet</h3>
            <p className="text-gray-500">This post doesn't have any products yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
