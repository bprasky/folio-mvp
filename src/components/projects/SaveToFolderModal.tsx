"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { X, Folder, Plus, Check } from "lucide-react";

interface Folder {
  id: string;
  name: string;
  createdAt: Date;
}

interface SaveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  eventId?: string;
  eventTitle?: string;
  onSuccess?: (folderId: string) => void;
}

export default function SaveToFolderModal({
  isOpen,
  onClose,
  productId,
  eventId,
  eventTitle,
  onSuccess,
}: SaveToFolderModalProps) {
  const { data: session } = useSession();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [recentlyUsedFolder, setRecentlyUsedFolder] = useState<string>("");

  // Load user's folders
  useEffect(() => {
    if (!isOpen) {
      setFoldersLoading(false);
      return;
    }

    if (!session?.user?.id) {
      console.warn("[SaveToFolderModal] No session or user ID", { 
        hasSession: !!session, 
        userId: session?.user?.id 
      });
      setFoldersLoading(false);
      return;
    }

    const loadFolders = async () => {
      setFoldersLoading(true);
      try {
        console.log("[SaveToFolderModal] Loading folders for user:", session.user.id);
        const response = await fetch("/api/designer/folders");
        
        if (!response.ok) {
          console.error("[SaveToFolderModal] Failed to fetch folders:", response.status, response.statusText);
          toast.error("Failed to load folders");
          return;
        }

        const data = await response.json();
        console.log("[SaveToFolderModal] Folders response:", { 
          folderCount: data.folders?.length || 0,
          folders: data.folders 
        });
        
        setFolders(data.folders || []);
        
        // Set default new folder name
        if (eventTitle) {
          setNewFolderName(`From ${eventTitle}`);
        }
        
        // Pre-select recently used folder from localStorage
        const lastUsed = localStorage.getItem("lastUsedFolder");
        if (lastUsed && data.folders?.some((f: Folder) => f.id === lastUsed)) {
          setSelectedFolderId(lastUsed);
          setRecentlyUsedFolder(lastUsed);
        }
      } catch (error) {
        console.error("[SaveToFolderModal] Error loading folders:", error);
        toast.error("Failed to load folders");
      } finally {
        setFoldersLoading(false);
      }
    };

    loadFolders();
  }, [isOpen, session?.user?.id, eventTitle]);

  const handleSave = async () => {
    if (!session?.user?.id) {
      toast.error("Please sign in to save products");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/products/${productId}/save-to-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          projectId: selectedFolderId || undefined,
          newProjectName: isCreatingNew ? newFolderName : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save product");
      }

      const data = await response.json();
      
      // Store last used folder
      if (data.folderId) {
        localStorage.setItem("lastUsedFolder", data.folderId);
      }

      toast.success(
        <div className="flex items-center gap-2">
          <span>Saved to {isCreatingNew ? newFolderName : folders.find(f => f.id === selectedFolderId)?.name}!</span>
          <button
            onClick={() => {
              onSuccess?.(data.folderId);
              onClose();
            }}
            className="px-3 py-1 bg-[var(--accent)] text-white text-xs rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Open
          </button>
        </div>
      );

      onSuccess?.(data.folderId);
      onClose();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save product. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: "select" | "new") => {
    setIsCreatingNew(tab === "new");
    if (tab === "new") {
      setSelectedFolderId("");
    } else {
      setNewFolderName("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 glass-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-folio-text-primary">Save to Project Folder</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-ground rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-folio-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tab Navigation */}
          <div className="flex bg-surface-ground rounded-xl p-1 mb-6">
            <button
              onClick={() => handleTabChange("select")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                !isCreatingNew
                  ? "bg-white text-folio-text-primary shadow-sm"
                  : "text-folio-text-secondary hover:text-folio-text-primary"
              }`}
            >
              Select Folder
            </button>
            <button
              onClick={() => handleTabChange("new")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                isCreatingNew
                  ? "bg-white text-folio-text-primary shadow-sm"
                  : "text-folio-text-secondary hover:text-folio-text-primary"
              }`}
            >
              New Folder
            </button>
          </div>

          {/* Select Existing Folder */}
          {!isCreatingNew && (
            <div className="space-y-3">
              {foldersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-12 bg-surface-ground rounded-xl"></div>
                    </div>
                  ))}
                </div>
              ) : folders.length === 0 ? (
                <div className="text-center py-8 text-folio-text-secondary">
                  <Folder className="w-12 h-12 mx-auto text-folio-text-tertiary mb-3" />
                  <p className="text-sm">No folders yet</p>
                  <button
                    onClick={() => handleTabChange("new")}
                    className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] mt-2"
                  >
                    Create your first folder
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                      className={`w-full p-3 text-left rounded-xl border-2 transition-all hover:shadow-sm ${
                        selectedFolderId === folder.id
                          ? "border-[var(--accent)] bg-[var(--accent)]/5"
                          : "border-folio-border-subtle hover:border-folio-border-subtle"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Folder className="w-5 h-5 text-folio-text-secondary" />
                          <div>
                            <p className="font-medium text-folio-text-primary">{folder.name}</p>
                            <p className="text-xs text-folio-text-secondary">
                              Created {new Date(folder.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {selectedFolderId === folder.id && (
                          <Check className="w-5 h-5 text-[var(--accent)]" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create New Folder */}
          {isCreatingNew && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-folio-text-primary mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name..."
                  className="w-full px-4 py-3 border border-folio-border-subtle rounded-xl focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                  autoFocus
                />
              </div>
              
              {eventTitle && (
                <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-3">
                  <p className="text-xs text-[var(--accent-hover)]">
                    <strong>Tip:</strong> This folder will be created from "{eventTitle}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-folio-text-primary bg-surface-ground rounded-xl hover:bg-surface-ground transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={
                loading ||
                (isCreatingNew && !newFolderName.trim()) ||
                (!isCreatingNew && !selectedFolderId)
              }
              className="flex-1 px-4 py-3 bg-[var(--accent)] text-white rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {isCreatingNew ? "Create & Save" : "Save to Folder"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
