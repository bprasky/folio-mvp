'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  FaPlay, FaPause, FaHeart, FaShare, FaEye, FaQuoteLeft,
  FaScissors, FaCopy, FaExternalLinkAlt, FaTag, FaUser,
  FaBuilding, FaClock, FaVolumeUp, FaVolumeMute,
  FaExpand, FaCompress, FaDownload, FaBookmark
} from 'react-icons/fa';
import Navigation from '../../../components/Navigation';

interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  creatorId: string;
  creatorType: 'designer' | 'vendor';
  tags: string[];
  views: number;
  likes: number;
  createdAt: string;
  transcript: string;
  pullQuotes: { timestamp: number; text: string; }[];
  mentionedProducts: string[];
  mentionedVendors: string[];
  clips: any[];
}

interface Creator {
  id: string;
  name: string;
  profileImage: string;
  bio?: string;
  followers?: number;
}

export default function VideoViewer() {
  const params = useParams();
  const videoId = params.id as string;
  
  const [video, setVideo] = useState<Video | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showClipModal, setShowClipModal] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(30);
  const [clipTitle, setClipTitle] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoId) {
      loadVideo();
    }
  }, [videoId]);

  const loadVideo = async () => {
    try {
      const response = await fetch(`/api/videos/${videoId}`);
      const data = await response.json();
      
      if (data.success) {
        setVideo(data.video);
        loadCreator(data.video.creatorId, data.video.creatorType);
      }
    } catch (error) {
      console.error('Error loading video:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCreator = async (creatorId: string, creatorType: string) => {
    try {
      const endpoint = creatorType === 'designer' ? '/api/designers' : '/api/admin/vendors';
      const response = await fetch(endpoint);
      const data = await response.json();
      
      let creatorData;
      if (creatorType === 'designer') {
        creatorData = data.find((d: any) => d.id === creatorId);
      } else {
        creatorData = data.success ? data.vendors.find((v: any) => v.id === creatorId) : null;
      }
      
      if (creatorData) {
        setCreator({
          id: creatorData.id,
          name: creatorData.name,
          profileImage: creatorData.profileImage || creatorData.logo || 'https://source.unsplash.com/random/100x100?profile',
          bio: creatorData.bio,
          followers: creatorData.followers
        });
      }
    } catch (error) {
      console.error('Error loading creator:', error);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const jumpToQuote = (timestamp: number) => {
    handleSeek(timestamp);
    if (!isPlaying) {
      handlePlayPause();
    }
  };

  const createClip = async () => {
    if (!video || !clipTitle.trim()) return;

    try {
      const response = await fetch('/api/videos/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          startTime: clipStart,
          endTime: clipEnd,
          title: clipTitle,
          quote: selectedQuote?.text || ''
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowClipModal(false);
        setClipTitle('');
        setSelectedQuote(null);
        // Reload video to get updated clips
        loadVideo();
      }
    } catch (error) {
      console.error('Error creating clip:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    // In production, make API call to update likes
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    // In production, make API call to save video
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    // Show toast notification
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading video...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Video not found</h2>
            <p className="text-gray-600 mb-4">The video you're looking for doesn't exist.</p>
            <Link
              href="/watch"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Browse Videos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Video Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Video Player */}
              <div ref={containerRef} className="relative bg-black rounded-xl overflow-hidden shadow-lg">
                <video
                  ref={videoRef}
                  src={video.videoUrl}
                  className="w-full aspect-video"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                
                {/* Video Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="w-full bg-gray-600 rounded-full h-1 cursor-pointer"
                         onClick={(e) => {
                           const rect = e.currentTarget.getBoundingClientRect();
                           const clickX = e.clientX - rect.left;
                           const newTime = (clickX / rect.width) * duration;
                           handleSeek(newTime);
                         }}>
                      <div 
                        className="bg-blue-500 h-1 rounded-full"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Control Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handlePlayPause}
                        className="text-white hover:text-blue-400 transition-colors"
                      >
                        {isPlaying ? <FaPause className="w-6 h-6" /> : <FaPlay className="w-6 h-6" />}
                      </button>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleMute}
                          className="text-white hover:text-blue-400 transition-colors"
                        >
                          {isMuted ? <FaVolumeMute className="w-5 h-5" /> : <FaVolumeUp className="w-5 h-5" />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="w-20"
                        />
                      </div>
                      
                      <span className="text-white text-sm">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>
                    
                    <button
                      onClick={toggleFullscreen}
                      className="text-white hover:text-blue-400 transition-colors"
                    >
                      {isFullscreen ? <FaCompress className="w-5 h-5" /> : <FaExpand className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Video Info */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">{video.title}</h1>
                
                {/* Stats and Actions */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <FaEye className="w-4 h-4" />
                      {formatViews(video.views)} views
                    </div>
                    <div className="flex items-center gap-1">
                      <FaClock className="w-4 h-4" />
                      {new Date(video.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleLike}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                        isLiked
                          ? 'bg-red-100 text-red-600 border border-red-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <FaHeart className="w-4 h-4" />
                      {video.likes + (isLiked ? 1 : 0)}
                    </button>
                    
                    <button
                      onClick={handleSave}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                        isSaved
                          ? 'bg-blue-100 text-blue-600 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <FaBookmark className="w-4 h-4" />
                      {isSaved ? 'Saved' : 'Save'}
                    </button>
                    
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                    >
                      <FaShare className="w-4 h-4" />
                      Share
                    </button>
                    
                    <button
                      onClick={() => {
                        setClipStart(Math.max(0, currentTime - 15));
                        setClipEnd(Math.min(duration, currentTime + 15));
                        setShowClipModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all"
                    >
                      <FaScissors className="w-4 h-4" />
                      Clip It
                    </button>
                  </div>
                </div>

                {/* Creator Info */}
                {creator && (
                  <div className="flex items-center gap-4 mb-4 p-4 bg-gray-50 rounded-xl">
                    <div className="w-12 h-12 relative rounded-full overflow-hidden">
                      <Image
                        src={creator.profileImage}
                        alt={creator.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{creator.name}</h3>
                      <p className="text-sm text-gray-600">
                        {video.creatorType === 'designer' ? 'Designer' : 'Vendor'}
                        {creator.followers && ` • ${formatViews(creator.followers)} followers`}
                      </p>
                    </div>
                    <Link
                      href={`/${video.creatorType}/${creator.id}`}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      View Profile
                    </Link>
                  </div>
                )}

                {/* Description */}
                {video.description && (
                  <div className="mb-4">
                    <p className="text-gray-700 leading-relaxed">{video.description}</p>
                  </div>
                )}

                {/* Tags */}
                {video.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {video.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/watch?tag=${tag}`}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Mentioned Products/Vendors */}
                {(video.mentionedProducts.length > 0 || video.mentionedVendors.length > 0) && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Featured in this video</h3>
                    
                    {video.mentionedProducts.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Products:</h4>
                        <div className="flex flex-wrap gap-2">
                          {video.mentionedProducts.map((product, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                            >
                              {product}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {video.mentionedVendors.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Vendors:</h4>
                        <div className="flex flex-wrap gap-2">
                          {video.mentionedVendors.map((vendor, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                            >
                              {vendor}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Transcript & Quotes */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Transcript & Highlights</h3>
                    <button
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      {showTranscript ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                
                {showTranscript && (
                  <div className="p-4 max-h-96 overflow-y-auto">
                    {/* Pull Quotes */}
                    {video.pullQuotes.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Key Quotes</h4>
                        <div className="space-y-3">
                          {video.pullQuotes.map((quote, index) => (
                            <div
                              key={index}
                              className="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                              onClick={() => jumpToQuote(quote.timestamp)}
                            >
                              <div className="flex items-start gap-2">
                                <FaQuoteLeft className="w-3 h-3 text-blue-600 mt-1 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-sm text-gray-800 italic mb-1">
                                    "{quote.text}"
                                  </p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-blue-600">
                                      {formatTime(quote.timestamp)}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedQuote(quote);
                                        setClipStart(Math.max(0, quote.timestamp - 5));
                                        setClipEnd(Math.min(duration, quote.timestamp + 25));
                                        setClipTitle(`"${quote.text.substring(0, 30)}..."`);
                                        setShowClipModal(true);
                                      }}
                                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                                    >
                                      <FaScissors className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full Transcript */}
                    {video.transcript && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Full Transcript</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {video.transcript}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Existing Clips */}
              {video.clips && video.clips.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">Clips from this video</h3>
                  <div className="space-y-2">
                    {video.clips.map((clip: any) => (
                      <Link
                        key={clip.id}
                        href={`/watch/clip/${clip.id}`}
                        className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <h4 className="text-sm font-medium text-gray-900 mb-1">
                          {clip.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{formatTime(clip.duration)} long</span>
                          <span>{clip.views} views</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Clip Creation Modal */}
      <AnimatePresence>
        {showClipModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">Create Clip</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clip Title
                  </label>
                  <input
                    type="text"
                    value={clipTitle}
                    onChange={(e) => setClipTitle(e.target.value)}
                    placeholder="Enter clip title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="number"
                      value={clipStart}
                      onChange={(e) => setClipStart(parseFloat(e.target.value))}
                      min="0"
                      max={duration}
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="number"
                      value={clipEnd}
                      onChange={(e) => setClipEnd(parseFloat(e.target.value))}
                      min={clipStart}
                      max={duration}
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="text-sm text-gray-600">
                  Clip duration: {formatTime(clipEnd - clipStart)}
                </div>
                
                {selectedQuote && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800 italic">
                      "{selectedQuote.text}"
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowClipModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createClip}
                  disabled={!clipTitle.trim()}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Clip
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 