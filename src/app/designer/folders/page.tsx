"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Folder, ArrowRight, Trash2, Edit3 } from "lucide-react";
import { useProjectFolder } from "@/contexts/ProjectFolderContext";

interface Folder {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  productCount: number;
}

export default function FoldersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { setCurrentFolderId } = useProjectFolder();
  
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  // Load folders
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadFolders = async () => {
      try {
        const response = await fetch("/api/designer/folders");
        if (response.ok) {
          const data = await response.json();
          setFolders(data.folders || []);
        }
      } catch (error) {
        console.error("Error loading folders:", error);
        toast.error("Failed to load folders");
      } finally {
        setLoading(false);
      }
    };

    loadFolders();
  }, [session?.user?.id]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newFolderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/designer/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to create folder");
      }

      const data = await response.json();
      setFolders(prev => [data.folder, ...prev]);
      setNewFolderName("");
      setShowCreateModal(false);
      toast.success("Folder created successfully!");
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Failed to create folder");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Are you sure you want to delete this folder? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/designer/folders/${folderId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete folder");
      }

      setFolders(prev => prev.filter(f => f.id !== folderId));
      toast.success("Folder deleted successfully");
    } catch (error) {
      console.error("Error deleting folder:", error);
      toast.error("Failed to delete folder");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded-lg w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-xl h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Project Folders</h1>
              <p className="text-gray-600 mt-2">
                Organize and manage your saved products
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Folder
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {folders.length === 0 ? (
          <div className="text-center py-16">
            <Folder className="w-24 h-24 mx-auto text-gray-300 mb-6" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No folders yet</h3>
            <p className="text-gray-500 mb-6">
              Create your first project folder to start organizing products
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              Create First Folder
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border border-gray-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Folder className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{folder.name}</h3>
                        <p className="text-sm text-gray-500">
                          {folder.productCount} product{folder.productCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/designer/folders/${folder.id}`)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ArrowRight className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      Created {new Date(folder.createdAt).toLocaleDateString()}
                    </span>
                    <span>
                      Updated {new Date(folder.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => router.push(`/designer/folders/${folder.id}`)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Open Folder
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Folder</h2>
              
              <form onSubmit={handleCreateFolder} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g., Kitchen Project, Bathroom Ideas..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    disabled={creating || !newFolderName.trim()}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {creating ? "Creating..." : "Create Folder"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
