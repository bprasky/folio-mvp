"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, Clock, AlertCircle, Mic } from "lucide-react";
import { useRouter } from "next/navigation";

interface BoostInboxClientProps {
  requests: Array<{
    id: string;
    status: string;
    message: string | null;
    requestedAt: Date;
    expiresAt: Date | null;
    acceptedAt: Date | null;
    completedAt: Date | null;
    product: {
      id: string;
      name: string;
      brand: string | null;
      imageUrl: string | null;
    };
    project: {
      id: string;
      title: string;
    };
    vendor: {
      id: string;
      name: string;
      logoUrl: string | null;
    };
    interviewSession: {
      id: string;
      status: string;
    } | null;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: {
    label: "Pending",
    color: "text-yellow-600",
    icon: <Clock className="h-4 w-4" />,
  },
  ACCEPTED: {
    label: "Accepted",
    color: "text-[var(--accent)]",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  COMPLETED: {
    label: "Completed",
    color: "text-green-600",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  DECLINED: {
    label: "Declined",
    color: "text-red-600",
    icon: <X className="h-4 w-4" />,
  },
  EXPIRED: {
    label: "Expired",
    color: "text-[var(--text-secondary)]",
    icon: <AlertCircle className="h-4 w-4" />,
  },
};

export function BoostInboxClient({ requests }: BoostInboxClientProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (requestId: string) => {
    setProcessingId(requestId);
    setError(null);

    try {
      const response = await fetch(`/api/vendor-boost/${requestId}/accept`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to accept request");
      }

      const result = await response.json();
      
      // Navigate to interview recording page
      if (result.interviewSession?.id) {
        router.push(`/designer/interviews/${result.interviewSession.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error("Accept error:", err);
      setError(err instanceof Error ? err.message : "Failed to accept request");
      setProcessingId(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setProcessingId(requestId);
    setError(null);

    try {
      const response = await fetch(`/api/vendor-boost/${requestId}/decline`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to decline request");
      }

      router.refresh();
    } catch (err) {
      console.error("Decline error:", err);
      setError(err instanceof Error ? err.message : "Failed to decline request");
      setProcessingId(null);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isExpired = (expiresAt: Date | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-[var(--ridge-outer)] p-12 text-center">
        <p className="text-[var(--text-secondary)]">No boost requests at this time</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {requests.map((request) => {
        const statusConfig = STATUS_CONFIG[request.status] || {
          label: request.status,
          color: "text-[var(--text-secondary)]",
          icon: <Clock className="h-4 w-4" />,
        };

        const expired = isExpired(request.expiresAt);

        return (
          <div
            key={request.id}
            className="bg-white rounded-lg shadow-sm border border-[var(--ridge-outer)] p-6 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                {/* Product Image */}
                {request.product.imageUrl && (
                  <img
                    src={request.product.imageUrl}
                    alt={request.product.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}

                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`text-sm font-medium ${statusConfig.color} flex items-center space-x-1`}>
                      {statusConfig.icon}
                      <span>{statusConfig.label}</span>
                    </span>
                    {expired && request.status === "PENDING" && (
                      <span className="text-xs text-red-600">(Expired)</span>
                    )}
                  </div>

                  <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">
                    {request.product.brand} {request.product.name}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-2">
                    In project: <span className="font-medium">{request.project.title}</span>
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Requested by <span className="font-medium">{request.vendor.name}</span> on{" "}
                    {formatDate(request.requestedAt)}
                  </p>
                  {request.expiresAt && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                      Expires: {formatDate(request.expiresAt)}
                    </p>
                  )}
                  {request.message && (
                    <div className="mt-3 p-3 bg-[var(--bg-elevated)] rounded text-sm text-[var(--text-primary)]">
                      "{request.message}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 border-t border-[var(--ridge-outer)] pt-4">
              {request.status === "PENDING" && !expired && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleDecline(request.id)}
                    disabled={processingId === request.id}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                  <Button
                    onClick={() => handleAccept(request.id)}
                    disabled={processingId === request.id}
                    className="bg-[var(--text-primary)] hover:opacity-90"
                  >
                    <Mic className="h-4 w-4 mr-1" />
                    Accept & Record
                  </Button>
                </>
              )}

              {request.status === "ACCEPTED" && request.interviewSession && (
                <Button
                  onClick={() => router.push(`/designer/interviews/${request.interviewSession!.id}`)}
                  variant="outline"
                >
                  Continue Interview
                </Button>
              )}

              {request.status === "COMPLETED" && (
                <span className="text-sm text-[var(--text-secondary)]">Completed</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}



