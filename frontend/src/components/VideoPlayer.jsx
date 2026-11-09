import React, { useEffect, useRef, useState, useCallback } from "react";
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
  RotateCcw,
  RotateCw,
  Check,
} from "lucide-react";
import api from "../api";

export const VideoPlayer = ({
  video: initialVideo,
  videoId,
  postId,
  onViewCounted,
  className = "",
}) => {
  const [video, setVideo] = useState(initialVideo || null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialVideo?.duration_seconds || 0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Twitter/X-style 3-second consecutive view counting state
  const hasCountedViewRef = useRef(false);
  const consecutiveWatchMsRef = useRef(0);
  const is50PercentVisibleRef = useRef(false);


  // Double-tap seek feedback animation
  const [seekFeedback, setSeekFeedback] = useState(null); // { type: 'rewind' | 'forward', time: 10 }
  const lastTapRef = useRef({ time: 0, x: 0 });
  const controlsTimeoutRef = useRef(null);

  // Quality levels
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 is Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Scrub bar hover tooltip
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  // Status flags
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
      setIsBuffering(false);
    }
  }, [initialVideo]);

  // Poll video processing status
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
        console.warn("[VideoPlayer] Polling error:", err.message);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [currentVideoId, isProcessing]);

  // Controls auto-hide timer (3 seconds)
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setShowQualityMenu(false);
      }
    }, 3000);
  }, []);

  // Compute YouTube-style forward buffer progress
  const updateBufferState = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    const totalDur = v.duration || duration || 0;
    if (totalDur <= 0 || v.buffered.length === 0) return;

    let bufferedEnd = 0;
    for (let i = 0; i < v.buffered.length; i++) {
      const start = v.buffered.start(i);
      const end = v.buffered.end(i);
      if (start <= v.currentTime && v.currentTime <= end) {
        bufferedEnd = end;
        break;
      } else if (end > bufferedEnd && end >= v.currentTime) {
        bufferedEnd = end;
      }
    }

    if (bufferedEnd === 0 && v.buffered.length > 0) {
      bufferedEnd = v.buffered.end(v.buffered.length - 1);
    }

    const pct = Math.min(100, Math.max(0, (bufferedEnd / totalDur) * 100));
    setBuffered(pct);
  }, [duration]);

  // Setup HLS.js streaming with YouTube-style aggressive forward buffer
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !isReady) return;

    const hlsUrl = video?.hls_url;
    const fallbackUrl = video?.download_url;

    if (!hlsUrl && !fallbackUrl) return;

    if (hlsUrl && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      // YouTube-like pre-buffering configuration
      const hls = new Hls({
        capLevelToPlayerSize: false, // Never cap resolution to small screen size
        autoStartLoad: true, // Attach manifest and media source immediately for instant play
        startFragPrefetch: false, // Don't prefetch chunks until needed
        maxBufferLength: 4, // Keep buffer small (only 1 short chunk) on initial load to save data
        maxMaxBufferLength: 8,
        maxBufferSize: 60 * 1024 * 1024, // 60MB memory buffer
        backBufferLength: 30, // Retain 30s behind playhead for instant rewind
        enableWorker: true,
        lowLatencyMode: false,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 4,
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

      // Update buffer visually as chunks arrive & clear loading indicator
      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        updateBufferState();
        setIsBuffering(false);
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setIsBuffering(false);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        setIsBuffering(false);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        setIsBuffering(false);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
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
      // Native Apple Safari HLS
      videoElement.src = hlsUrl;
    } else if (fallbackUrl) {
      videoElement.src = fallbackUrl;
    }
  }, [video?.hls_url, video?.download_url, isReady, updateBufferState]);

  // Video event listeners for buffering & time
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onWaiting = () => {
      setIsBuffering(true);
      consecutiveWatchMsRef.current = 0;
    };
    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const onPause = () => {
      setIsPlaying(false);
      setShowControls(true);
      setIsBuffering(false);
      consecutiveWatchMsRef.current = 0;
    };
    const onSeeking = () => {
      consecutiveWatchMsRef.current = 0;
    };
    const onCanPlay = () => setIsBuffering(false);
    const onLoadedData = () => setIsBuffering(false);
    const onSeeked = () => setIsBuffering(false);
    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      consecutiveWatchMsRef.current = 0;
    };
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      updateBufferState();
    };
    const onProgress = () => {
      updateBufferState();
    };
    const onLoadedMetadata = () => {
      setDuration(v.duration || video?.duration_seconds || 0);
      updateBufferState();
      setIsBuffering(false);
    };

    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("canplaythrough", onCanPlay);
    v.addEventListener("loadeddata", onLoadedData);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("error", onError);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("progress", onProgress);
    v.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("canplaythrough", onCanPlay);
      v.removeEventListener("loadeddata", onLoadedData);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("error", onError);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("progress", onProgress);
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [updateBufferState, video?.duration_seconds]);

  // Reset view counter if current video changes
  useEffect(() => {
    hasCountedViewRef.current = false;
    consecutiveWatchMsRef.current = 0;
  }, [currentVideoId]);

  // Twitter/X-style 3-second consecutive watch view counting
  useEffect(() => {
    if (!isPlaying || hasCountedViewRef.current) return;

    const interval = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || v.ended || v.seeking || isBuffering) {
        consecutiveWatchMsRef.current = 0;
        return;
      }

      if (is50PercentVisibleRef.current) {
        consecutiveWatchMsRef.current += 200;
        if (consecutiveWatchMsRef.current >= 3000 && !hasCountedViewRef.current) {
          hasCountedViewRef.current = true;
          clearInterval(interval);

          const effectivePostId = postId || video?.post_id;
          const effectiveVideoId = video?.id || videoId;

          if (effectivePostId) {
            api
              .post(`/posts/${effectivePostId}/view`)
              .then((res) => {
                if (onViewCounted) {
                  onViewCounted(res.data?.data?.views_count);
                }
              })
              .catch((err) => {
                console.warn("[VideoPlayer] Post view recording note:", err.message);
              });
          } else if (effectiveVideoId) {
            api
              .post(`/videos/${effectiveVideoId}/view`)
              .then((res) => {
                if (onViewCounted) {
                  onViewCounted(
                    res.data?.data?.post_views_count || res.data?.data?.video_views_count
                  );
                }
              })
              .catch((err) => {
                console.warn("[VideoPlayer] Video view recording note:", err.message);
              });
          }
        }
      } else {
        // Less than 50% visible, reset consecutive watch timer
        consecutiveWatchMsRef.current = 0;
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying, isBuffering, postId, video?.post_id, video?.id, videoId, onViewCounted]);

  // Auto-pause and stop data loading when scrolled out of view, and monitor >= 50% viewport visibility
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const is50 = entry.isIntersecting && entry.intersectionRatio >= 0.5;
          is50PercentVisibleRef.current = is50;

          if (!is50) {
            // Drop below 50% resets the consecutive watch counter
            consecutiveWatchMsRef.current = 0;
          }

          if (entry.intersectionRatio < 0.2 && videoRef.current) {
            if (!videoRef.current.paused) {
              videoRef.current.pause();
              setIsPlaying(false);
            }
            // Stop downloading chunks when user scrolls past video
            if (hlsRef.current) {
              hlsRef.current.stopLoad();
            }
          } else if (entry.intersectionRatio >= 0.2) {
            // Resume loading chunks if user scrolls back into view
            if (hlsRef.current) {
              hlsRef.current.startLoad();
            }
          }
        });
      },
      { threshold: [0.0, 0.2, 0.5] }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Listen to fullscreenchange
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Close quality menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".quality-menu-container")) {
        setShowQualityMenu(false);
      }
    };
    if (showQualityMenu) {
      document.addEventListener("click", handleOutsideClick);
      return () => document.removeEventListener("click", handleOutsideClick);
    }
  }, [showQualityMenu]);

  // Toggle play/pause (Click anywhere on video or play button)
  const togglePlay = (e) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    resetControlsTimeout();
    if (v.paused) {
      // Aggressive YouTube buffer on play
      if (hlsRef.current) {
        hlsRef.current.config.maxBufferLength = 60;
        hlsRef.current.config.maxMaxBufferLength = 120;
        hlsRef.current.startLoad();
      }
      setIsBuffering(v.readyState < 3);

      v.play()
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch((err) => {
          console.warn("[VideoPlayer] Play error:", err.message);
          // If play failed due to browser audio autoplay policy, fallback to muted play
          if (err.name === "NotAllowedError") {
            v.muted = true;
            setIsMuted(true);
            v.play()
              .then(() => {
                setIsPlaying(true);
                setIsBuffering(false);
              })
              .catch(() => setIsBuffering(false));
          } else {
            setIsBuffering(false);
          }
        });
    } else {
      v.pause();
      setIsPlaying(false);
      setIsBuffering(false);
    }
  };

  // Click anywhere on video screen: Toggle Play/Pause (or double tap to seek ±10s)
  const handleContainerClick = (e) => {
    e.stopPropagation();
    const now = Date.now();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isDoubleTap = now - lastTapRef.current.time < 300;

    if (isDoubleTap) {
      // Double Tap: Left 38% rewinds 10s, Right 38% forwards 10s
      const width = rect.width;
      const v = videoRef.current;
      if (v) {
        if (clickX < width * 0.38) {
          v.currentTime = Math.max(0, v.currentTime - 10);
          setSeekFeedback({ type: "rewind", amount: 10 });
          setTimeout(() => setSeekFeedback(null), 650);
        } else if (clickX > width * 0.62) {
          v.currentTime = Math.min(v.duration || duration, v.currentTime + 10);
          setSeekFeedback({ type: "forward", amount: 10 });
          setTimeout(() => setSeekFeedback(null), 650);
        } else {
          togglePlay();
        }
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      // Single Click / Tap ANYWHERE on video screen: TOGGLE PLAY / PAUSE!
      lastTapRef.current = { time: now, x: clickX };
      togglePlay();
    }
  };

  // Seek bar scrub interaction
  const handleSeek = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetDur = v.duration || duration || 0;
    const newTime = pos * targetDur;
    v.currentTime = newTime;
    setCurrentTime(newTime);
    resetControlsTimeout();
  };

  // Hover position on seek bar
  const handleSeekMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetDur = videoRef.current?.duration || duration || 0;
    setHoverPosition(pos * 100);
    setHoverTime(pos * targetDur);
  };

  // Smooth Quality Selection Without Freezing
  const handleQualitySelect = (qualityIndex) => {
    setCurrentQuality(qualityIndex);
    setShowQualityMenu(false);
    resetControlsTimeout();

    const hls = hlsRef.current;
    if (!hls) return;

    const v = videoRef.current;
    const wasPlaying = v && !v.paused;

    // Use nextLevel for seamless transition at next segment boundary
    hls.nextLevel = qualityIndex; // -1 = Auto

    // If video is paused, immediately set currentLevel so quality changes right away
    if (!wasPlaying) {
      hls.currentLevel = qualityIndex;
    } else {
      // If playing, ensure playback does not stall
      setIsBuffering(true);
      const onLevelSwitched = () => {
        setIsBuffering(false);
        if (v && v.paused && wasPlaying) {
          v.play().catch(() => {});
        }
        hls.off(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
      };
      hls.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
    }
  };

  // Mute / Unmute
  const toggleMute = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    resetControlsTimeout();
    const nextMuted = !isMuted;
    v.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      setVolume(0.5);
      v.volume = 0.5;
    }
  };

  // Volume slider (Desktop)
  const handleVolumeChange = (e) => {
    e.stopPropagation();
    const newVol = parseFloat(e.target.value);
    const v = videoRef.current;
    if (v) {
      v.volume = newVol;
      v.muted = newVol === 0;
      setVolume(newVol);
      setIsMuted(newVol === 0);
    }
    resetControlsTimeout();
  };

  // Fullscreen toggle (Mobile & Desktop compatible)
  const toggleFullscreen = (e) => {
    e.stopPropagation();
    const c = containerRef.current;
    const v = videoRef.current;
    if (!c) return;

    resetControlsTimeout();

    // iOS Safari native fullscreen handling
    if (v && v.webkitEnterFullscreen && !document.fullscreenEnabled) {
      v.webkitEnterFullscreen();
      return;
    }

    if (!document.fullscreenElement) {
      if (c.requestFullscreen) {
        c.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      } else if (c.webkitRequestFullscreen) {
        c.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Direct download
  const handleDownload = (e) => {
    e.stopPropagation();
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

  // Dynamic aspect ratio calculation
  const getAspectRatioStyle = () => {
    if (video?.width && video?.height) {
      const ratio = video.width / video.height;
      // Clamp ratio between 0.56 (9:16 vertical) and 1.78 (16:9 landscape)
      const clampedRatio = Math.max(0.56, Math.min(1.78, ratio));
      return { aspectRatio: `${clampedRatio}` };
    }
    return { aspectRatio: "16 / 9" };
  };

  // 1. Processing state
  if (isProcessing) {
    return (
      <div
        className={`relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 p-5 sm:p-6 flex flex-col items-center justify-center min-h-[200px] text-center ${className}`}
        style={getAspectRatioStyle()}
      >
        <div className="relative mb-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#7C3AED]/30 border-t-[#7C3AED] animate-spin" />
          <Loader2 className="absolute inset-0 m-auto text-[#7C3AED] animate-pulse" size={18} />
        </div>
        <h4 className="text-white font-bold text-[14px] sm:text-[15px] mb-1">
          Processing Video...
        </h4>
        <p className="text-slate-400 text-[12px] sm:text-[13px] max-w-xs px-2">
          Generating adaptive HLS stream tiers and fast-download MP4. Video will play automatically once ready.
        </p>
      </div>
    );
  }

  // 2. Failed state
  if (isFailed) {
    return (
      <div
        className={`relative w-full rounded-2xl overflow-hidden bg-red-950/40 border border-red-900/60 p-5 sm:p-6 flex flex-col items-center justify-center min-h-[180px] text-center ${className}`}
      >
        <AlertCircle size={30} className="text-red-400 mb-2" />
        <h4 className="text-red-200 font-bold text-[14px] mb-1">
          Video Processing Failed
        </h4>
        <p className="text-red-300/80 text-[12px] max-w-xs px-2">
          {video.error_message || "Video transcoding failed. Max supported duration is 120 seconds."}
        </p>
      </div>
    );
  }

  // Active Video Player
  const totalDuration = videoRef.current?.duration || duration || 1;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseMove={resetControlsTimeout}
      className={`group relative isolate z-0 w-full rounded-2xl overflow-hidden bg-black select-none cursor-pointer flex items-center justify-center max-h-[520px] sm:max-h-[580px] ${className}`}
      style={getAspectRatioStyle()}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={video?.thumbnail_url || undefined}
        onEnded={() => setIsPlaying(false)}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain pointer-events-none"
      />

      {/* Buffering Spinner Overlay */}
      {isBuffering && (
        <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center pointer-events-none z-10">
          <Loader2 size={24} className="text-[#A78BFA] animate-spin" />
        </div>
      )}

      {/* Double Tap Seek Feedback Ripple (+10s / -10s) */}
      {seekFeedback && (
        <div
          className={`absolute inset-y-0 ${
            seekFeedback.type === "rewind" ? "left-0 w-1/3 bg-white/10" : "right-0 w-1/3 bg-white/10"
          } flex items-center justify-center pointer-events-none transition-all duration-300 animate-in fade-in z-10`}
        >
          <div className="flex flex-col items-center text-white bg-black/70 backdrop-blur-md px-3 py-2 rounded-2xl shadow-xl">
            {seekFeedback.type === "rewind" ? <RotateCcw size={22} /> : <RotateCw size={22} />}
            <span className="text-[12px] font-bold mt-1">
              {seekFeedback.type === "rewind" ? "-10s" : "+10s"}
            </span>
          </div>
        </div>
      )}

      {/* Center Big Play/Pause Button on Pause or Tap */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-14 h-14 sm:w-16 sm:h-16 bg-black/65 hover:bg-black/85 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-2xl transition-all border border-white/20 active:scale-95 z-10"
          title="Play"
        >
          <Play size={26} className="ml-1 fill-white" />
        </button>
      )}

      {/* YouTube-Inspired Control Bar Overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 sm:p-3 pt-6 sm:pt-8 transition-opacity duration-200 flex flex-col gap-1.5 sm:gap-2 z-20 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Scrub Bar Container */}
        <div
          onClick={handleSeek}
          onMouseMove={handleSeekMouseMove}
          onMouseLeave={() => setHoverTime(null)}
          className="group/seek relative w-full h-2 sm:h-2 hover:h-3 bg-white/25 rounded-full cursor-pointer transition-all flex items-center"
        >
          {/* YouTube Pre-chunk Buffer Bar (Forward Buffer) */}
          <div
            className="absolute top-0 left-0 h-full bg-white/45 rounded-full transition-all duration-300"
            style={{ width: `${buffered}%` }}
          />

          {/* Current Played Progress Bar */}
          <div
            className="absolute top-0 left-0 h-full bg-[#7C3AED] rounded-full"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Scrub Handle / Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover/seek:scale-100 transition-transform -ml-1.5"
            style={{ left: `${progressPercent}%` }}
          />

          {/* Timestamp Hover Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 bg-black/85 backdrop-blur-md text-white text-[10px] font-mono rounded shadow pointer-events-none"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between text-white text-[12px] sm:text-[13px] px-0.5">
          {/* Left Controls: Play/Pause, Mute, Time */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 hover:text-[#A78BFA] active:scale-95 transition-all"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="fill-white" />}
            </button>

            {/* Mute Button */}
            <button
              type="button"
              onClick={toggleMute}
              className="p-1.5 hover:text-[#A78BFA] active:scale-95 transition-all"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Desktop Volume Slider (Hidden on mobile to prevent overcrowding) */}
            <div className="hidden sm:flex items-center">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 h-1 accent-[#7C3AED] bg-white/30 rounded-full appearance-none cursor-pointer"
                title="Volume"
              />
            </div>

            {/* Time Stamp */}
            <span className="text-[11px] sm:text-[12px] text-white/90 font-mono tracking-tight whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
          </div>

          {/* Right Controls: Quality, Download, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Resolution Selector Popover */}
            {qualities.length > 0 && (
              <div className="relative quality-menu-container">
                <button
                  type="button"
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="px-2 py-1 rounded-full text-[11px] font-semibold bg-white/15 hover:bg-white/25 active:bg-white/30 transition-all flex items-center gap-1 border border-white/10"
                  title="Stream Quality"
                >
                  <Settings size={12} className="animate-spin-hover" />
                  <span>
                    {currentQuality === -1
                      ? "Auto"
                      : qualities.find((q) => q.index === currentQuality)?.label || "Auto"}
                  </span>
                </button>

                {/* Quality Popover (Mobile touch-friendly) */}
                {showQualityMenu && (
                  <div className="absolute bottom-9 right-0 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl py-1.5 min-w-[120px] backdrop-blur-xl z-30 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-white/5">
                      Quality
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQualitySelect(-1)}
                      className={`w-full text-left px-3 py-2 text-[12px] flex items-center justify-between hover:bg-white/10 active:bg-white/20 transition-colors ${
                        currentQuality === -1 ? "text-[#A78BFA] font-bold" : "text-white"
                      }`}
                    >
                      <span>Auto</span>
                      {currentQuality === -1 && <Check size={14} className="text-[#A78BFA]" />}
                    </button>
                    {qualities.map((q) => (
                      <button
                        key={q.index}
                        type="button"
                        onClick={() => handleQualitySelect(q.index)}
                        className={`w-full text-left px-3 py-2 text-[12px] flex items-center justify-between hover:bg-white/10 active:bg-white/20 transition-colors ${
                          currentQuality === q.index ? "text-[#A78BFA] font-bold" : "text-white"
                        }`}
                      >
                        <span>{q.label}</span>
                        {currentQuality === q.index && <Check size={14} className="text-[#A78BFA]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Direct Download Button */}
            {video?.download_url && (
              <button
                type="button"
                onClick={handleDownload}
                className="p-1.5 hover:text-[#A78BFA] active:scale-95 transition-all"
                title="Download MP4"
              >
                <Download size={16} />
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 hover:text-[#A78BFA] active:scale-95 transition-all"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
