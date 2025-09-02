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
    if (!isOpen || !session?.user?.id) return;

    const loadFolders = async () => {
      try {
        const response = await fetch("/api/designer/folders");
        if (response.ok) {
          const data = await response.json();
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
        }
      } catch (error) {
        console.error("Error loading folders:", error);
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
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Save to Project Folder</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tab Navigation */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => handleTabChange("select")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                !isCreatingNew
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Select Folder
            </button>
            <button
              onClick={() => handleTabChange("new")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                isCreatingNew
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
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
                      <div className="h-12 bg-gray-200 rounded-xl"></div>
                    </div>
                  ))}
                </div>
              ) : folders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Folder className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm">No folders yet</p>
                  <button
                    onClick={() => handleTabChange("new")}
                    className="text-xs text-blue-600 hover:text-blue-700 mt-2"
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
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Folder className="w-5 h-5 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900">{folder.name}</p>
                            <p className="text-xs text-gray-500">
                              Created {new Date(folder.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {selectedFolderId === folder.id && (
                          <Check className="w-5 h-5 text-blue-500" />
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  autoFocus
                />
              </div>
              
              {eventTitle && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs text-blue-700">
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
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
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
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
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
