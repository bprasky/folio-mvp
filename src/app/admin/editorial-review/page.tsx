'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaCheck, FaTimes, FaEye, FaCalendarAlt, FaUser, FaArrowLeft, FaNewspaper, FaClock } from 'react-icons/fa';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

interface EditorialSubmission {
  id: string;
  projectId: string;
  designerId: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  project?: {
    id: string;
    name: string;
    description: string;
    heroImage?: string;
    category: string;
    designerId: string;
  };
}

export default function EditorialReviewPage() {
  const [submissions, setSubmissions] = useState<EditorialSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, [selectedTab]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/editorial-submissions?status=${selectedTab}`);

      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const data = await response.json();
      setSubmissions(data);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Failed to load editorial submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (submissionId: string) => {
    if (!confirm('Are you sure you want to approve this project for editorial publication?')) {
      return;
    }

    try {
      setProcessingId(submissionId);
      const response = await fetch('/api/editorial-submissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionId,
          action: 'approve',
          reviewedBy: 'admin'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve submission');
      }

      alert('Project approved for editorial publication!');
      fetchSubmissions();
    } catch (error) {
      console.error('Error approving submission:', error);
      alert('Failed to approve submission. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (submissionId: string) => {
    const rejectionReason = prompt('Please provide a reason for rejection (optional):');

    if (!confirm('Are you sure you want to reject this editorial submission?')) {
      return;
    }

    try {
      setProcessingId(submissionId);
      const response = await fetch('/api/editorial-submissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionId,
          action: 'reject',
          rejectionReason: rejectionReason || 'No reason provided',
          reviewedBy: 'admin'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject submission');
      }

      alert('Submission rejected successfully.');
      fetchSubmissions();
    } catch (error) {
      console.error('Error rejecting submission:', error);
      alert('Failed to reject submission. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-surface-ground text-folio-text-secondary';
    }
  };

  const getTabCount = () => {
    // This would be fetched from API in a real implementation
    return submissions.length;
  };

  return (
    <div className="min-h-screen bg-surface-canvas">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/admin"
                className="flex items-center text-[var(--accent)] hover:text-[var(--accent-hover)] mb-4"
              >
                <FaArrowLeft className="mr-2" /> Back to Admin Dashboard
              </Link>
              <h1 className="folio-h1 flex items-center">
                <FaNewspaper className="mr-4 text-[var(--accent)]" />
                Editorial Review
              </h1>
              <p className="folio-body mt-2">
                Review and manage project submissions for editorial publication
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <RidgeCard padding="none" className="mb-6">
          <div className="border-b border-[var(--border-subtle)]">
            <nav className="flex space-x-8 px-6">
              {[
                { key: 'pending', label: 'Pending Review', icon: FaClock },
                { key: 'approved', label: 'Approved', icon: FaCheck },
                { key: 'rejected', label: 'Rejected', icon: FaTimes },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedTab(tab.key as 'pending' | 'approved' | 'rejected')}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    selectedTab === tab.key
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-folio-text-secondary hover:text-folio-text-primary hover:border-[var(--border-subtle)]'
                  }`}
                >
                  <tab.icon className="mr-2" />
                  {tab.label}
                  <span className="ml-2 bg-surface-ground text-folio-text-secondary py-1 px-2 rounded-full text-xs">
                    {getTabCount()}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </RidgeCard>

        {/* Content */}
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
              <p className="mt-4 text-folio-text-secondary">Loading submissions...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
              <Button
                variant="accent"
                onClick={fetchSubmissions}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          ) : submissions.length === 0 ? (
            <RidgeCard padding="xl" className="text-center">
              <FaNewspaper className="mx-auto h-16 w-16 text-folio-text-tertiary mb-4" />
              <h3 className="folio-h3 mb-2">
                No {selectedTab} submissions
              </h3>
              <p className="folio-body">
                {selectedTab === 'pending'
                  ? "No projects are currently awaiting review."
                  : `No projects have been ${selectedTab}.`
                }
              </p>
            </RidgeCard>
          ) : (
            <div className="grid gap-6">
              {submissions.map((submission) => (
                <RidgeCard key={submission.id} padding="lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="folio-h3 mr-3">
                          {submission.project?.name || 'Untitled Project'}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                          {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                        </span>
                      </div>

                      <div className="flex items-center folio-meta mb-3 space-x-4">
                        <div className="flex items-center">
                          <FaUser className="mr-1" />
                          Designer ID: {submission.designerId}
                        </div>
                        <div className="flex items-center">
                          <FaCalendarAlt className="mr-1" />
                          Submitted: {formatDate(submission.submittedAt)}
                        </div>
                        {submission.reviewedAt && (
                          <div className="flex items-center">
                            <FaCheck className="mr-1" />
                            Reviewed: {formatDate(submission.reviewedAt)}
                          </div>
                        )}
                      </div>

                      <p className="folio-body mb-4 line-clamp-3">
                        {submission.project?.description || 'No description available'}
                      </p>

                      {submission.rejectionReason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                          <p className="text-sm text-red-700">
                            <strong>Rejection Reason:</strong> {submission.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>

                    {submission.project?.heroImage && (
                      <div className="ml-6 flex-shrink-0">
                        <div className="relative w-32 h-24 rounded-lg overflow-hidden">
                          <Image
                            src={submission.project.heroImage}
                            alt={submission.project.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center space-x-3">
                      <Link href={`/project/${submission.projectId}`}>
                        <Button variant="ridge">
                          <FaEye className="mr-2" />
                          View Project
                        </Button>
                      </Link>
                    </div>

                    {selectedTab === 'pending' && (
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(submission.id)}
                          disabled={processingId === submission.id}
                        >
                          <FaTimes className="mr-2" />
                          {processingId === submission.id ? 'Processing...' : 'Reject'}
                        </Button>
                        <Button
                          variant="accent"
                          onClick={() => handleApprove(submission.id)}
                          disabled={processingId === submission.id}
                        >
                          <FaCheck className="mr-2" />
                          {processingId === submission.id ? 'Processing...' : 'Approve & Publish'}
                        </Button>
                      </div>
                    )}
                  </div>
                </RidgeCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
