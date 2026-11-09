import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Settings,
  Loader2,
  AlertCircle,
} from "lucide-react";
import api from "../api";

export const VideoPlayer = ({ video: initialVideo, videoId, className = "" }) => {
  const [video, setVideo] = useState(initialVideo || null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialVideo?.duration_seconds || 0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);

  // Quality levels
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 is Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Polling for processing status
  const currentVideoId = video?.id || videoId;
  const isProcessing =
    video?.status === "initiated" ||
    video?.status === "uploaded" ||
    video?.status === "processing";
  const isFailed = video?.status === "failed";
  const isReady = video?.status === "ready";

  useEffect(() => {
    if (initialVideo) {
      setVideo(initialVideo);
    }
  }, [initialVideo]);

  // Poll video status if processing
  useEffect(() => {
    if (!currentVideoId || !isProcessing) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/videos/${currentVideoId}/status`);
        const data = res.data?.data;
        if (data) {
          setVideo((prev) => ({ ...prev, ...data }));
          if (data.status === "ready" || data.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.warn("Error polling video status:", err.message);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentVideoId, isProcessing]);

  // HLS.js streaming setup
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !isReady) return;

    const hlsUrl = video.hls_url;
    const fallbackUrl = video.download_url;

    if (!hlsUrl && !fallbackUrl) return;

    if (hlsUrl && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        const levels = data.levels.map((level, index) => ({
          index,
          height: level.height,
          bitrate: level.bitrate,
          label: `${level.height}p`,
        }));
        setQualities(levels);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        // Track current quality level
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              // Fallback to MP4 download URL
              hls.destroy();
              if (fallbackUrl) {
                videoElement.src = fallbackUrl;
              }
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (
      videoElement.canPlayType("application/vnd.apple.mpegurl") &&
      hlsUrl
    ) {
      // Native Safari HLS
      videoElement.src = hlsUrl;
    } else if (fallbackUrl) {
      videoElement.src = fallbackUrl;
    }
  }, [video?.hls_url, video?.download_url, isReady]);

  // Auto-pause when scrolled out of view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Controls auto-hide timer
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  const togglePlay = (e) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);

    if (v.buffered.length > 0) {
      const bufferedEnd = v.buffered.end(v.buffered.length - 1);
      setBuffered((bufferedEnd / (v.duration || 1)) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (v) {
      setDuration(v.duration || video?.duration_seconds || 0);
    }
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    v.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = (e) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    const newMuted = !isMuted;
    v.muted = newMuted;
    setIsMuted(newMuted);
    if (!newMuted && volume === 0) {
      setVolume(0.5);
      v.volume = 0.5;
    }
  };

  const handleVolumeChange = (e) => {
    e?.stopPropagation();
    const newVol = parseFloat(e.target.value);
    const v = videoRef.current;
    if (v) {
      v.volume = newVol;
      v.muted = newVol === 0;
      setVolume(newVol);
      setIsMuted(newVol === 0);
    }
  };

  const toggleFullscreen = (e) => {
    e?.stopPropagation();
    const c = containerRef.current;
    if (!c) return;

    if (!document.fullscreenElement) {
      c.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleQualitySelect = (qualityIndex) => {
    setCurrentQuality(qualityIndex);
    setShowQualityMenu(false);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = qualityIndex; // -1 for auto
    }
  };

  const handleDownload = (e) => {
    e?.stopPropagation();
    if (!video?.download_url) return;
    const a = document.createElement("a");
    a.href = video.download_url;
    a.download = video.original_filename || "video.mp4";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // 1. Rendering Processing State
  if (isProcessing) {
    return (
      <div className={`relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 p-6 flex flex-col items-center justify-center min-h-[220px] text-center ${className}`}>
        <div className="relative mb-3">
          <div className="w-12 h-12 rounded-full border-2 border-[#7C3AED]/30 border-t-[#7C3AED] animate-spin flex items-center justify-center" />
          <Loader2 className="absolute inset-0 m-auto text-[#7C3AED] animate-pulse" size={20} />
        </div>
        <h4 className="text-white font-bold text-[15px] mb-1">
          Processing Video...
        </h4>
        <p className="text-slate-400 text-[13px] max-w-sm">
          Transcoding multi-bitrate HLS streams for smooth playback. Video will play automatically once ready.
        </p>
      </div>
    );
  }

  // 2. Rendering Failed State
  if (isFailed) {
    return (
      <div className={`relative w-full rounded-2xl overflow-hidden bg-red-950/40 border border-red-900/60 p-6 flex flex-col items-center justify-center min-h-[180px] text-center ${className}`}>
        <AlertCircle size={32} className="text-red-400 mb-2" />
        <h4 className="text-red-200 font-bold text-[14px] mb-1">
          Video Processing Failed
        </h4>
        <p className="text-red-300/80 text-[12px] max-w-xs">
          {video.error_message || "The video could not be processed. Please check file format and duration (max 120s)."}
        </p>
      </div>
    );
  }

  // 3. Rendering Active Video Player
  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={togglePlay}
      className={`group relative w-full rounded-2xl overflow-hidden bg-black select-none cursor-pointer max-h-[580px] flex items-center justify-center ${className}`}
    >
      <video
        ref={videoRef}
        poster={video?.thumbnail_url || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        playsInline
        className="w-full h-full max-h-[580px] object-contain"
      />

      {/* Center Play Button Overlay on Pause */}
      {!isPlaying && (
        <div className="absolute inset-0 m-auto w-14 h-14 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 transition-all border border-white/20">
          <Play size={24} className="ml-1 fill-white" />
        </div>
      )}

      {/* Control Bar Overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 transition-opacity duration-200 flex flex-col gap-2 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Scrub Bar */}
        <div
          onClick={handleSeek}
          className="relative w-full h-1.5 hover:h-2.5 bg-white/20 rounded-full cursor-pointer transition-all overflow-hidden"
        >
          {/* Buffer Bar */}
          <div
            className="absolute top-0 left-0 h-full bg-white/30"
            style={{ width: `${buffered}%` }}
          />
          {/* Progress Bar */}
          <div
            className="absolute top-0 left-0 h-full bg-[#7C3AED]"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between text-white text-[13px]">
          {/* Left: Play/Pause, Volume, Time */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-1 hover:text-[#A78BFA] transition-colors"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="fill-white" />}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1 group/vol">
              <button
                onClick={toggleMute}
                className="p-1 hover:text-[#A78BFA] transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 h-1 accent-[#7C3AED] bg-white/30 rounded-full appearance-none cursor-pointer"
              />
            </div>

            {/* Time Stamp */}
            <span className="text-[12px] text-white/80 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right: Quality, Download, Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Quality Selector */}
            {qualities.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1"
                  title="Quality"
                >
                  <Settings size={13} />
                  <span>
                    {currentQuality === -1
                      ? "Auto"
                      : qualities.find((q) => q.index === currentQuality)?.label || "Auto"}
                  </span>
                </button>

                {showQualityMenu && (
                  <div className="absolute bottom-8 right-0 bg-slate-900/95 border border-slate-700 rounded-xl shadow-xl py-1 min-w-[90px] backdrop-blur-md z-30">
                    <button
                      onClick={() => handleQualitySelect(-1)}
                      className={`w-full text-left px-3 py-1 text-[12px] hover:bg-white/10 transition-colors ${
                        currentQuality === -1 ? "text-[#A78BFA] font-bold" : "text-white"
                      }`}
                    >
                      Auto
                    </button>
                    {qualities.map((q) => (
                      <button
                        key={q.index}
                        onClick={() => handleQualitySelect(q.index)}
                        className={`w-full text-left px-3 py-1 text-[12px] hover:bg-white/10 transition-colors ${
                          currentQuality === q.index ? "text-[#A78BFA] font-bold" : "text-white"
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Download Button */}
            {video?.download_url && (
              <button
                onClick={handleDownload}
                className="p-1 hover:text-[#A78BFA] transition-colors"
                title="Download video"
              >
                <Download size={17} />
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-1 hover:text-[#A78BFA] transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;

