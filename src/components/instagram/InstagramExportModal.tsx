/**
 * Main Instagram export modal
 * Combines image reordering, quote selection, preview, and export
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { FaTimes, FaInstagram, FaDownload, FaImage } from 'react-icons/fa';
import ImageReorderGrid from './ImageReorderGrid';
import QuoteSelector from './QuoteSelector';
import CarouselPreview from './CarouselPreview';
import ExportButton from './ExportButton';

interface ProjectImage {
  id: string;
  url: string;
  name?: string | null;
}

interface InstagramExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  images: ProjectImage[];
  expandedBlocks?: any; // ProjectPost.expandedBlocks
}

export default function InstagramExportModal({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  images,
  expandedBlocks,
}: InstagramExportModalProps) {
  const [orderedImageIds, setOrderedImageIds] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<string[]>([]);
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [caption, setCaption] = useState<string>('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [loadingCaption, setLoadingCaption] = useState(false);
  const [activeTab, setActiveTab] = useState<'reorder' | 'quotes' | 'preview' | 'caption'>('reorder');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [downloadingSlide, setDownloadingSlide] = useState(false);
  const [reuploadingImages, setReuploadingImages] = useState(false);
  const [reuploadComplete, setReuploadComplete] = useState(false);
  const [facebookImageCount, setFacebookImageCount] = useState(0);

  // Re-upload Facebook CDN images to Supabase (client-side fetch to bypass CDN restrictions)
  const handleReuploadImages = async (imageIdsToReupload?: string[]) => {
    // Find images with Facebook CDN URLs (or use provided IDs)
    const facebookImages = imageIdsToReupload 
      ? images.filter(img => imageIdsToReupload.includes(img.id))
      : images.filter(img => 
          img.url.includes('fbcdn.net') || 
          img.url.includes('facebook.com') ||
          img.url.includes('scontent-')
        );

    if (facebookImages.length === 0) {
      if (!imageIdsToReupload) {
        // Only show alert if manually triggered
        alert('No Facebook CDN images found. All images are already on Supabase.');
      }
      setFacebookImageCount(0);
      setReuploadComplete(true);
      return;
    }

    setReuploadingImages(true);
    setReuploadComplete(false);
    setFacebookImageCount(facebookImages.length);
    
    try {
      // Use client-side fetch to get images (browser can access Facebook CDN)
      const reuploadPromises = facebookImages.map(async (img) => {
        try {
          console.log(`[Reupload] Fetching image from browser: ${img.url.substring(0, 100)}...`);
          
          // Fetch image using browser (bypasses server-side restrictions)
          const imageResponse = await fetch(img.url, {
            mode: 'cors',
            credentials: 'omit',
          });

          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch: ${imageResponse.status}`);
          }

          const blob = await imageResponse.blob();
          
          // Convert blob to base64 for upload
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const base64 = reader.result as string;
              resolve(base64.split(',')[1]); // Remove data:image/...;base64, prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          
          const base64Data = await base64Promise;
          const mimeType = blob.type || 'image/jpeg';

          // Upload to Supabase via API
          console.log(`[Reupload] Uploading image ${img.id} to Supabase (${base64Data.length} bytes base64, mime: ${mimeType})`);
          
          const uploadResponse = await fetch(`/api/projects/${projectId}/images/reupload-client`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageId: img.id,
              imageData: base64Data,
              mimeType,
              room: img.room || 'default',
            }),
          });

          if (!uploadResponse.ok) {
            let errorMessage = `HTTP ${uploadResponse.status}`;
            try {
              const contentType = uploadResponse.headers.get('content-type');
              if (contentType?.includes('application/json')) {
                const errorData = await uploadResponse.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
                console.error(`[Reupload] Upload failed for ${img.id}:`, errorData);
              } else {
                const text = await uploadResponse.text();
                console.error(`[Reupload] Upload failed for ${img.id}, non-JSON response:`, text.substring(0, 200));
                errorMessage = `Server error (${uploadResponse.status}): ${text.substring(0, 100)}`;
              }
            } catch (parseError) {
              console.error(`[Reupload] Failed to parse error response for ${img.id}:`, parseError);
              errorMessage = `Failed to parse error: ${uploadResponse.status}`;
            }
            throw new Error(errorMessage);
          }

          const result = await uploadResponse.json();
          console.log(`[Reupload] Successfully uploaded ${img.id}:`, result.newUrl);
          return result;
        } catch (error: any) {
          console.error(`[Reupload] Failed for image ${img.id}:`, error);
          return { imageId: img.id, error: error.message };
        }
      });

      const results = await Promise.all(reuploadPromises);
      const successful = results.filter(r => !r.error);
      const failed = results.filter(r => r.error);

      console.log(`[Reupload] Results: ${successful.length} successful, ${failed.length} failed`);
      
      if (failed.length > 0) {
        console.warn(`[Reupload] ${failed.length} image(s) failed to re-upload:`, failed);
        // Show detailed error for each failed image
        failed.forEach((f: any) => {
          console.error(`[Reupload] Failed image ${f.imageId}:`, f.error);
        });
      }

      if (successful.length > 0) {
        console.log(`[Reupload] Successfully re-uploaded ${successful.length} image(s) to Supabase`);
        setReuploadComplete(true);
        setFacebookImageCount(failed.length); // Update count to remaining failed images
        
        if (failed.length === 0) {
          // All images succeeded - refresh page to get updated URLs
          setTimeout(() => {
            window.location.reload();
          }, 1000); // Small delay to show success message
        } else {
          // Some succeeded, some failed - show message
          alert(`${successful.length} image(s) re-uploaded successfully. ${failed.length} image(s) failed. Check console for details.`);
        }
      } else {
        // All images failed, update count and show error
        setFacebookImageCount(failed.length);
        const errorMessages = failed.map((f: any) => `${f.imageId}: ${f.error}`).join('\n');
        alert(`All ${failed.length} image(s) failed to re-upload:\n\n${errorMessages.substring(0, 500)}`);
      }
    } catch (error: any) {
      console.error('[InstagramExportModal] Error re-uploading images:', error);
      if (!imageIdsToReupload) {
        // Only show alert if manually triggered
        alert(`Failed to re-upload images: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setReuploadingImages(false);
    }
  };

  // Initialize ordered image IDs and auto-re-upload Facebook CDN images
  useEffect(() => {
    if (images.length > 0 && orderedImageIds.length === 0) {
      // Use displayOrder if available, otherwise use current order
      const sorted = [...images];
      setOrderedImageIds(sorted.map(img => img.id));
      
      // Check for Facebook CDN images
      const facebookImages = images.filter(img => 
        img.url.includes('fbcdn.net') || 
        img.url.includes('facebook.com') ||
        img.url.includes('scontent-')
      );
      
      setFacebookImageCount(facebookImages.length);
      
      // Automatically re-upload Facebook CDN images when modal opens
      if (facebookImages.length > 0 && isOpen) {
        console.log(`[InstagramExportModal] Detected ${facebookImages.length} Facebook CDN image(s), auto-re-uploading...`);
        handleReuploadImages(facebookImages.map(img => img.id));
      } else if (facebookImages.length === 0) {
        setReuploadComplete(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, orderedImageIds.length, isOpen]);

  // Debug: Log images when they change
  useEffect(() => {
    if (images.length > 0) {
      console.log('[InstagramExportModal] Images received:', images.length, images);
    } else {
      console.warn('[InstagramExportModal] No images received');
    }
  }, [images]);

  // Extract quotes on mount
  useEffect(() => {
    if (expandedBlocks) {
      // Import extractQuotes dynamically
      import('@/lib/instagram/extractQuotes').then(({ extractQuotes }) => {
        const extracted = extractQuotes(expandedBlocks);
        setQuotes(extracted);
        setSelectedQuotes(extracted.slice(0, 4)); // Auto-select first 4
      });
    }
  }, [expandedBlocks]);

  // Load caption
  const loadCaption = async () => {
    setLoadingCaption(true);
    try {
      const response = await fetch('/api/instagram/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCaption(data.caption);
        setHashtags(data.hashtags);
      }
    } catch (error) {
      console.error('[InstagramExportModal] Error loading caption:', error);
    } finally {
      setLoadingCaption(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'caption' && !caption) {
      loadCaption();
    }
  }, [activeTab, caption]);

  const handleReorder = (newOrder: string[]) => {
    setOrderedImageIds(newOrder);
  };

  const orderedImages = orderedImageIds
    .map(id => images.find(img => img.id === id))
    .filter(Boolean) as ProjectImage[];

  // Download all slides as individual JPGs
  const handleDownloadAllSlides = async () => {
    if (activeTab !== 'preview') {
      return; // Only allow download when preview tab is active
    }

    // Check for Facebook CDN images that cannot be fetched server-side
    const facebookImages = orderedImages.filter(img => 
      img.url.includes('fbcdn.net') || 
      img.url.includes('facebook.com') ||
      img.url.includes('scontent-')
    );

    if (facebookImages.length > 0) {
      const proceed = confirm(
        `Warning: ${facebookImages.length} image(s) are still on Facebook CDN and cannot be downloaded server-side.\n\n` +
        `Please:\n` +
        `1. Wait for the automatic re-upload to complete (check the status bar at the bottom of this modal)\n` +
        `2. Click "Re-upload Now" if the status shows Facebook CDN images\n` +
        `3. Wait for the page to refresh automatically\n` +
        `4. Then try downloading again\n\n` +
        `Would you like to proceed anyway? (Images will show as "unavailable" placeholders)`
      );
      if (!proceed) {
        return;
      }
    }

    setDownloadingSlide(true);
    try {
      // Calculate total number of slides: 1 hero + images.length + 1 CTA
      const totalSlides = 1 + orderedImages.length + 1;
      
      // Generate all slides sequentially (with error handling for individual slides)
      const slidePromises = [];
      for (let i = 0; i < totalSlides; i++) {
        slidePromises.push(
          fetch('/api/instagram/slide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              slideIndex: i,
              orderedImageIds,
              selectedQuotes,
            }),
          }).then(async (response) => {
            if (!response.ok) {
              // Try to parse error as JSON, but handle HTML error pages
              let errorMessage = `HTTP ${response.status}`;
              try {
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                  const errorData = await response.json();
                  errorMessage = errorData.error || errorData.message || errorMessage;
                } else {
                  // HTML error page - read text to see what it says
                  const text = await response.text();
                  console.warn(`[DownloadAllSlides] Slide ${i + 1} returned HTML instead of JSON:`, text.substring(0, 200));
                  errorMessage = `Server error (${response.status}) - check server logs`;
                }
              } catch (parseError) {
                errorMessage = `Failed to parse error response: ${response.status}`;
              }
              console.warn(`[DownloadAllSlides] Slide ${i + 1} failed:`, errorMessage);
              return { error: errorMessage, slideIndex: i };
            }
            
            // Parse JSON response
            try {
              return await response.json();
            } catch (jsonError: any) {
              // If response is not JSON, it might be HTML
              const text = await response.text();
              console.error(`[DownloadAllSlides] Slide ${i + 1} response is not JSON:`, text.substring(0, 200));
              return { error: 'Invalid response format (expected JSON)', slideIndex: i };
            }
          }).catch((error) => {
            // Catch network errors too
            console.warn(`[DownloadAllSlides] Slide ${i + 1} network error:`, error.message);
            return { error: error.message, slideIndex: i };
          })
        );
      }

      const slideDataArray = await Promise.all(slidePromises);
      
      // Filter out failed slides and show warning
      const failedSlides = slideDataArray.filter((data, index) => data.error);
      const successfulSlides = slideDataArray.filter((data) => !data.error);
      
      if (failedSlides.length > 0) {
        console.warn(`[DownloadAllSlides] ${failedSlides.length} slide(s) failed to generate`);
        // Show user-friendly message
        alert(`${successfulSlides.length} of ${totalSlides} slides downloaded successfully. ${failedSlides.length} slide(s) failed (likely due to image access restrictions).`);
      }
      
      // Only download successful slides
      const slidesToDownload = successfulSlides;

      if (slidesToDownload.length === 0) {
        alert('No slides were generated successfully. Please check your images and try again.');
        return;
      }

      // Download each successful slide with a small delay to avoid browser popup blockers
      for (let index = 0; index < slidesToDownload.length; index++) {
        const data = slidesToDownload[index];
        
        // Safety check: ensure image data exists
        if (!data.image || typeof data.image !== 'string') {
          console.warn(`[DownloadAllSlides] Slide ${index + 1} missing image data:`, data);
          continue;
        }

        try {
          // Extract base64 data (handle both data URL format and plain base64)
          const base64Data = data.image.includes(',') 
            ? data.image.split(',')[1] 
            : data.image;
          
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'image/jpeg' });

          // Trigger download with sequential naming
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `folio-instagram-slide-${String(index + 1).padStart(2, '0')}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);

          // Small delay between downloads to avoid browser blocking
          if (index < slidesToDownload.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (downloadError: any) {
          console.error(`[DownloadAllSlides] Failed to download slide ${index + 1}:`, downloadError);
          // Continue with next slide instead of stopping
        }
      }
    } catch (error: any) {
      console.error('[InstagramExportModal] Error downloading slides:', error);
      alert(`Failed to download slides: ${error.message || 'Please try again.'}`);
    } finally {
      setDownloadingSlide(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-4xl w-full bg-surface-canvas rounded-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-folio-border-subtle">
            <div className="flex items-center gap-3">
              <FaInstagram className="w-6 h-6 text-pink-600" />
              <DialogTitle className="text-2xl font-serif font-bold text-folio-text-primary">
                Export to Instagram
              </DialogTitle>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-ground rounded-full transition-colors"
              aria-label="Close"
            >
              <FaTimes className="w-5 h-5 text-folio-text-secondary" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-folio-border-subtle">
            {[
              { id: 'reorder', label: 'Reorder Images' },
              { id: 'quotes', label: 'Select Quotes' },
              { id: 'preview', label: 'Preview' },
              { id: 'caption', label: 'Caption' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'text-folio-text-secondary hover:text-folio-text-primary hover:bg-surface-ground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'reorder' && (
              <div className="space-y-4">
                <p className="text-sm text-folio-text-secondary">
                  Drag and drop images to reorder them for your Instagram carousel.
                </p>
                {images.length === 0 ? (
                  <div className="text-center py-12 text-folio-text-secondary">
                    <p className="mb-2">No images found for this project.</p>
                    <p className="text-sm">Please upload images to the project first.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-folio-text-secondary mb-2">
                      {images.length} image{images.length !== 1 ? 's' : ''} available
                    </p>
                    <ImageReorderGrid images={images} onReorder={handleReorder} />
                  </>
                )}
              </div>
            )}

            {activeTab === 'quotes' && (
              <div className="space-y-4">
                <QuoteSelector
                  quotes={quotes}
                  selectedQuotes={selectedQuotes}
                  onSelectionChange={setSelectedQuotes}
                />
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="space-y-4">
                <p className="text-sm text-folio-text-secondary">
                  Preview your Instagram carousel. Swipe horizontally to navigate.
                </p>
                <CarouselPreview
                  images={orderedImages}
                  quotes={selectedQuotes}
                  projectTitle={projectTitle}
                  expandedBlocks={expandedBlocks}
                  onCurrentSlideChange={setCurrentSlideIndex}
                />
              </div>
            )}

            {activeTab === 'caption' && (
              <div className="space-y-4">
                {loadingCaption ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
                    <p className="mt-2 text-sm text-folio-text-secondary">Generating caption...</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-folio-text-primary mb-2">
                        Caption
                      </label>
                      <textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        rows={8}
                        className="w-full px-4 py-3 border border-folio-border-subtle rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none"
                        placeholder="Caption will be generated automatically..."
                      />
                      <p className="mt-1 text-xs text-folio-text-secondary">
                        {caption.length} / 2200 characters
                      </p>
                    </div>
                    {hashtags.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-folio-text-primary mb-2">
                          Hashtags
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {hashtags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-surface-ground text-folio-text-primary rounded-full text-sm"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-folio-border-subtle bg-surface-ground">
            {/* Show re-upload status */}
            {(reuploadingImages || facebookImageCount > 0 || reuploadComplete) && (
              <div className={`mb-4 p-3 rounded-lg ${
                reuploadingImages 
                  ? 'bg-orange-50 border border-orange-200' 
                  : reuploadComplete && facebookImageCount === 0
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}>
                {reuploadingImages ? (
                  <div className="flex items-center gap-2 text-sm text-orange-700">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                    <span>Re-uploading {facebookImageCount} image(s) to Supabase... Please wait.</span>
                  </div>
                ) : reuploadComplete && facebookImageCount === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>All images re-uploaded successfully! Refreshing page...</span>
                  </div>
                ) : facebookImageCount > 0 ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-yellow-700">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{facebookImageCount} image(s) still on Facebook CDN. Click below to re-upload.</span>
                    </div>
                    <button
                      onClick={() => {
                        const facebookImages = images.filter(img => 
                          img.url.includes('fbcdn.net') || 
                          img.url.includes('facebook.com') ||
                          img.url.includes('scontent-')
                        );
                        if (facebookImages.length > 0) {
                          handleReuploadImages(facebookImages.map(img => img.id));
                        }
                      }}
                      className="px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded transition-colors"
                    >
                      Re-upload Now
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <ExportButton
                  projectId={projectId}
                  orderedImageIds={orderedImageIds}
                  selectedQuotes={selectedQuotes}
                  onExportComplete={() => {
                    // Optionally close modal after export
                    // onClose();
                  }}
                />
              </div>
              {/* Download All Slides Button - only show when preview tab is active */}
              {activeTab === 'preview' && (
                <button
                  onClick={handleDownloadAllSlides}
                  disabled={downloadingSlide || orderedImages.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-[var(--text-tertiary)]/40 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
                  title="Download all carousel slides as individual JPGs (1080×1350)"
                >
                  {downloadingSlide ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <FaDownload className="w-4 h-4" />
                      <FaImage className="w-4 h-4" />
                      <span>Download All Slides</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

