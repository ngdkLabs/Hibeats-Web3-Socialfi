/**
 * Simple Emoji Picker Component
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
}

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳'],
  'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Objects': ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🎮', '🎯', '🎲', '🎰'],
}

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Smileys')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button data-emoji-picker className="hidden">
          Emoji
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-[#1a1625] border-white/10 p-0 rounded-xl" align="start">
        <div className="flex flex-col">
          {/* Category Tabs */}
          <div className="flex gap-1 p-2 border-b border-white/10 overflow-x-auto">
            {Object.keys(EMOJI_CATEGORIES).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  selectedCategory === category
                    ? 'bg-lime-400 text-black font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Emoji Grid */}
          <div className="grid grid-cols-8 gap-1 p-2 max-h-64 overflow-y-auto">
            {EMOJI_CATEGORIES[selectedCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, index) => (
              <button
                key={index}
                onClick={() => onEmojiSelect(emoji)}
                className="text-2xl hover:bg-white/10 rounded-lg p-1 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
