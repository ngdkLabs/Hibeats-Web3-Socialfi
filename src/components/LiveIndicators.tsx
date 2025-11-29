// Live Indicators Component - Shows real-time view counts and typing indicators
// Showcases Somnia Data Streams real-time capabilities

import { Eye, MessageCircle } from 'lucide-react';
import { useLiveIndicators } from '@/hooks/useLiveIndicators';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveIndicatorsProps {
  postId: string;
  className?: string;
}

export function LiveIndicators({ postId, className = '' }: LiveIndicatorsProps) {
  const { viewerCount, activeTypers } = useLiveIndicators(postId);

  // Debug logging
  console.log(`🎨 [LiveIndicators] Rendering for post ${postId.substring(0, 10)}:`, {
    viewerCount,
    activeTypers: activeTypers.length,
    hasViewers: viewerCount > 0,
    hasTypers: activeTypers.length > 0
  });

  return null;
}

// Typing Indicator for Comment Input
interface TypingIndicatorInputProps {
  postId: string;
  onTyping?: (isTyping: boolean) => void;
}

export function TypingIndicatorInput({ postId, onTyping }: TypingIndicatorInputProps) {
  const { updateTyping } = useLiveIndicators(postId);

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const isTyping = (e.target as HTMLInputElement).value.length > 0;
    updateTyping(isTyping);
    onTyping?.(isTyping);
  };

  return {
    onInput: handleInput,
    onBlur: () => updateTyping(false),
  };
}
