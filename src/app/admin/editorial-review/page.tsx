'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaCheck, FaTimes, FaEye, FaCalendarAlt, FaUser, FaArrowLeft, FaNewspaper, FaClock } from 'react-icons/fa';

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
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'approved': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTabCount = (status: string) => {
    // This would be fetched from API in a real implementation
    return submissions.length;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      
      
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                href="/admin" 
                className="flex items-center text-blue-600 hover:underline mb-4"
              >
                <FaArrowLeft className="mr-2" /> Back to Admin Dashboard
              </Link>
              <h1 className="text-4xl font-bold text-gray-800 flex items-center">
                <FaNewspaper className="mr-4 text-blue-600" />
                Editorial Review
              </h1>
              <p className="text-gray-600 mt-2">
                Review and manage project submissions for editorial publication
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { key: 'pending', label: 'Pending Review', icon: FaClock },
                { key: 'approved', label: 'Approved', icon: FaCheck },
                { key: 'rejected', label: 'Rejected', icon: FaTimes },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedTab(tab.key as any)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    selectedTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="mr-2" />
                  {tab.label}
                  <span className="ml-2 bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                    {getTabCount(tab.key)}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading submissions...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
              <button 
                onClick={fetchSubmissions}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12">
              <FaNewspaper className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No {selectedTab} submissions
              </h3>
              <p className="text-gray-500">
                {selectedTab === 'pending' 
                  ? "No projects are currently awaiting review."
                  : `No projects have been ${selectedTab}.`
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {submissions.map((submission) => (
                <div 
                  key={submission.id} 
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <h3 className="text-xl font-semibold text-gray-900 mr-3">
                            {submission.project?.name || 'Untitled Project'}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                            {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                          </span>
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-600 mb-3 space-x-4">
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

                        <p className="text-gray-700 mb-4 line-clamp-3">
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

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex items-center space-x-3">
                        <Link
                          href={`/project/${submission.projectId}`}
                          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <FaEye className="mr-2" />
                          View Project
                        </Link>
                      </div>

                      {selectedTab === 'pending' && (
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleReject(submission.id)}
                            disabled={processingId === submission.id}
                            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            <FaTimes className="mr-2" />
                            {processingId === submission.id ? 'Processing...' : 'Reject'}
                          </button>
                          <button
                            onClick={() => handleApprove(submission.id)}
                            disabled={processingId === submission.id}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            <FaCheck className="mr-2" />
                            {processingId === submission.id ? 'Processing...' : 'Approve & Publish'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 