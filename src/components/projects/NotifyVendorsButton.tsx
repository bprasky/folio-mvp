"use client";

import { useState } from "react";
import { FaEnvelope } from "react-icons/fa";

interface NotifyVendorsButtonProps {
  projectId: string;
  className?: string;
}

export default function NotifyVendorsButton({
  projectId,
  className = "",
}: NotifyVendorsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNotify = async () => {
    if (!confirm("Send notifications to all vendors whose products are used in this project?")) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/projects/${projectId}/notify-vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to notify vendors");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleNotify}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
      >
        <FaEnvelope className="w-4 h-4" />
        <span>{isLoading ? "Sending..." : "Notify Vendors"}</span>
      </button>

      {success && (
        <div className="mt-2 text-sm text-green-600">
          ✓ Notifications sent successfully!
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600">
          ✗ {error}
        </div>
      )}
    </div>
  );
}




