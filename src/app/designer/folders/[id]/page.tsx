"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Edit3, Trash2, Share2 } from "lucide-react";
import FolderAssignPanel from "@/components/projects/FolderAssignPanel";
import { useProjectFolder } from "@/contexts/ProjectFolderContext";

interface Folder {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  productCount: number;
}

export default function FolderPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const { setCurrentFolderId } = useProjectFolder();
  
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);

  const folderId = params.id as string;

  useEffect(() => {
    if (!session?.user?.id || !folderId) return;

    // Set current folder in context
    setCurrentFolderId(folderId);

    const loadFolder = async () => {
      try {
        const response = await fetch(`/api/designer/folders/${folderId}`);
        if (response.ok) {
          const data = await response.json();
          setFolder(data.folder);
        } else {
          toast.error("Failed to load folder");
          router.push("/designer/folders");
        }
      } catch (error) {
        console.error("Error loading folder:", error);
        toast.error("Failed to load folder");
      } finally {
        setLoading(false);
      }
    };

    loadFolder();
  }, [session?.user?.id, folderId, setCurrentFolderId, router]);

  const handleDeleteFolder = async () => {
    if (!confirm("Are you sure you want to delete this folder? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/designer/folders/${folderId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Folder deleted successfully");
        router.push("/designer/folders");
      } else {
        throw new Error("Failed to delete folder");
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
      toast.error("Failed to delete folder");
    }
  };

  const handleCreatePost = () => {
    // Navigate to post creation with folder context
    router.push(`/designer/posts/new?folderId=${folderId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded-lg w-1/3 mb-6"></div>
            <div className="h-12 bg-gray-200 rounded-xl w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-gray-200 rounded-xl h-32"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Folder not found</h1>
          <button
            onClick={() => router.push("/designer/folders")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Folders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push("/designer/folders")}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
                  <p className="text-sm text-gray-500">
                    Created {new Date(folder.createdAt).toLocaleDateString()} • {folder.productCount} products
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreatePost}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Post
                </button>

                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Share2 className="w-4 h-4 text-gray-600" />
                </button>

                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Edit3 className="w-4 h-4 text-gray-600" />
                </button>

                <button
                  onClick={handleDeleteFolder}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FolderAssignPanel 
          folderId={folderId} 
          onUpdate={() => {
            // Refresh folder data if needed
            setFolder(prev => prev ? { ...prev, productCount: prev.productCount } : null);
          }}
        />
      </div>
    </div>
  );
}
