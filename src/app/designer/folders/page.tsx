"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Folder, ArrowRight, Trash2, Edit3 } from "lucide-react";
import { useProjectFolder } from "@/contexts/ProjectFolderContext";
import { RidgeCard } from "@/components/ui/ridge-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <div className="min-h-screen bg-[var(--bg-base)] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-[var(--bg-elevated)] rounded-lg w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[var(--bg-elevated)] rounded-xl h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Header */}
      <RidgeCard padding="lg" className="rounded-none border-x-0 border-t-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="folio-h1 text-[var(--text-primary)]">Project Folders</h1>
              <p className="folio-body text-[var(--text-secondary)] mt-2">
                Organize and manage your saved products
              </p>
            </div>

            <Button
              variant="accent"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Folder
            </Button>
          </div>
        </div>
      </RidgeCard>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {folders.length === 0 ? (
          <div className="text-center py-16">
            <Folder className="w-24 h-24 mx-auto text-[var(--text-tertiary)] mb-6" />
            <h3 className="folio-h2 text-[var(--text-primary)] mb-2">No folders yet</h3>
            <p className="folio-body text-[var(--text-secondary)] mb-6">
              Create your first project folder to start organizing products
            </p>
            <Button
              variant="accent"
              onClick={() => setShowCreateModal(true)}
            >
              Create First Folder
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {folders.map((folder) => (
              <RidgeCard
                key={folder.id}
                padding="lg"
                className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[var(--accent)]/10 rounded-xl flex items-center justify-center">
                      <Folder className="w-6 h-6 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="folio-h3 text-[var(--text-primary)]">{folder.name}</h3>
                      <p className="folio-meta">
                        {folder.productCount} product{folder.productCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/designer/folders/${folder.id}`)}
                      className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors"
                    >
                      <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between folio-meta">
                  <span>
                    Created {new Date(folder.createdAt).toLocaleDateString()}
                  </span>
                  <span>
                    Updated {new Date(folder.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-4">
                  <Button
                    variant="accent"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push(`/designer/folders/${folder.id}`)}
                  >
                    Open Folder
                  </Button>
                </div>
              </RidgeCard>
            ))}
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <RidgeCard padding="lg" className="w-full max-w-md">
            <h2 className="folio-h2 text-[var(--text-primary)] mb-4">Create New Folder</h2>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block folio-body font-medium text-[var(--text-primary)] mb-2">
                  Folder Name
                </label>
                <Input
                  variant="ridge"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g., Kitchen Project, Bathroom Ideas..."
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="ridge"
                  className="flex-1"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="accent"
                  className="flex-1"
                  disabled={creating || !newFolderName.trim()}
                >
                  {creating ? "Creating..." : "Create Folder"}
                </Button>
              </div>
            </form>
          </RidgeCard>
        </div>
      )}
    </div>
  );
}
