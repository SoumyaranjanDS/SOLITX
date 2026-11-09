import React from "react";
import { ImageIcon, Video, Heart, MessageCircle, Repeat2, Bookmark } from "lucide-react";

export const FeedSkeleton = ({ count = 3 }) => {
  return (
    <div className="divide-y divide-[#EFF3F4] select-none">
      {/* 1. Photo Post Skeleton */}
      <div className="flex gap-3 px-4 py-4 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="h-4 bg-gray-200 rounded-md w-28" />
            <div className="h-3 bg-gray-200 rounded-md w-20" />
          </div>
          <div className="h-3.5 bg-gray-200 rounded-md w-4/5" />
          <div className="h-3.5 bg-gray-200 rounded-md w-3/5" />

          {/* Photo Media Placeholder Box */}
          <div className="mt-2.5 w-full h-56 sm:h-64 rounded-2xl bg-gray-200/90 border border-gray-300/40 flex flex-col items-center justify-center text-gray-400 gap-1 relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-gray-300/60 flex items-center justify-center text-gray-500">
              <ImageIcon size={24} className="opacity-60" />
            </div>
            <span className="text-[11px] font-semibold text-gray-400 tracking-wide uppercase mt-1">Photo</span>
          </div>

          {/* Action Row */}
          <div className="flex justify-between items-center pt-2 max-w-[340px] text-gray-300">
            <MessageCircle size={17} />
            <Repeat2 size={17} />
            <Heart size={17} />
            <Bookmark size={17} />
          </div>
        </div>
      </div>

      {/* 2. Video Post Skeleton */}
      <div className="flex gap-3 px-4 py-4 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="h-4 bg-gray-200 rounded-md w-32" />
            <div className="h-3 bg-gray-200 rounded-md w-16" />
          </div>
          <div className="h-3.5 bg-gray-200 rounded-md w-11/12" />

          {/* Video Media Placeholder Box */}
          <div className="mt-2.5 w-full h-56 sm:h-72 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-500 gap-2 relative overflow-hidden shadow-inner">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white/40 shadow-lg">
              <Video size={24} className="ml-0.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase">Video Post</span>
          </div>

          {/* Action Row */}
          <div className="flex justify-between items-center pt-2 max-w-[340px] text-gray-300">
            <MessageCircle size={17} />
            <Repeat2 size={17} />
            <Heart size={17} />
            <Bookmark size={17} />
          </div>
        </div>
      </div>

      {/* 3. Text Post Skeleton */}
      <div className="flex gap-3 px-4 py-4 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="h-4 bg-gray-200 rounded-md w-24" />
            <div className="h-3 bg-gray-200 rounded-md w-16" />
          </div>
          <div className="h-3.5 bg-gray-200 rounded-md w-full" />
          <div className="h-3.5 bg-gray-200 rounded-md w-4/5" />
          <div className="h-3.5 bg-gray-200 rounded-md w-2/5" />

          {/* Action Row */}
          <div className="flex justify-between items-center pt-2 max-w-[340px] text-gray-300">
            <MessageCircle size={17} />
            <Repeat2 size={17} />
            <Heart size={17} />
            <Bookmark size={17} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedSkeleton;
