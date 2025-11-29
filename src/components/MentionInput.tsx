/**
 * MentionInput Component
 * 
 * Textarea dengan fitur autocomplete untuk @mention
 * - Mendeteksi @ dan menampilkan dropdown user
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Click to select user
 */

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { mentionService, MentionUser } from '@/services/mentionService';
import { User } from 'lucide-react';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  rows?: number;
  disabled?: boolean;
}

export const MentionInput = ({
  value,
  onChange,
  placeholder = 'Type @ to mention someone...',
  className = '',
  maxLength,
  rows = 3,
  disabled = false,
}: MentionInputProps) => {
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load mention users when query changes
  useEffect(() => {
    if (!showMentionDropdown || !mentionQuery) {
      setMentionUsers([]);
      return;
    }

    const loadMentions = async () => {
      setIsLoadingMentions(true);
      try {
        const users = await mentionService.getUsersForMention(mentionQuery, 10);
        setMentionUsers(users);
        setSelectedMentionIndex(0);
      } catch (error) {
        console.error('Error loading mentions:', error);
        setMentionUsers([]);
      } finally {
        setIsLoadingMentions(false);
      }
    };

    const debounceTimer = setTimeout(loadMentions, 200);
    return () => clearTimeout(debounceTimer);
  }, [mentionQuery, showMentionDropdown]);

  // Handle text change
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);
    
    // Check for @ mention trigger
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if we're in a mention context (no spaces after @)
      if (!textAfterAt.includes(' ') && textAfterAt.length <= 20) {
        setShowMentionDropdown(true);
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  // Handle mention selection
  const selectMention = (user: MentionUser) => {
    if (!textareaRef.current) return;
    
    const beforeMention = value.substring(0, mentionStartPos);
    const afterMention = value.substring(textareaRef.current.selectionStart);
    
    const newValue = `${beforeMention}@${user.username} ${afterMention}`;
    onChange(newValue);
    
    // Set cursor position after mention
    const newCursorPos = mentionStartPos + user.username.length + 2; // +2 for @ and space
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
    
    setShowMentionDropdown(false);
    setMentionQuery('');
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionDropdown || mentionUsers.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < mentionUsers.length - 1 ? prev + 1 : 0
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : mentionUsers.length - 1
        );
        break;
        
      case 'Enter':
        if (mentionUsers[selectedMentionIndex]) {
          e.preventDefault();
          selectMention(mentionUsers[selectedMentionIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        setShowMentionDropdown(false);
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (dropdownRef.current && showMentionDropdown) {
      const selectedElement = dropdownRef.current.children[selectedMentionIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedMentionIndex, showMentionDropdown]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
        maxLength={maxLength}
        rows={rows}
        disabled={disabled}
      />
      
      {/* Mention Dropdown */}
      {showMentionDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full max-w-md mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto custom-scrollbar"
          style={{
            top: '100%',
            left: 0,
          }}
        >
          {isLoadingMentions ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm mt-2">Loading users...</p>
            </div>
          ) : mentionUsers.length > 0 ? (
            <div className="py-1">
              {mentionUsers.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => selectMention(user)}
                  className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/80 transition-all duration-200 group ${
                    index === selectedMentionIndex ? 'bg-accent' : ''
                  }`}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback>
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm group-hover:text-primary transition-colors">{user.displayName}</span>
                      {user.isVerified && <VerifiedBadge size="sm" />}
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">@{user.username}</span>
                  </div>
                  
                  {user.isArtist && (
                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                      Artist
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">No users found</p>
              <p className="text-xs mt-1">Try a different search</p>
            </div>
          )}
        </div>
      )}
      
      {/* Character count */}
      {maxLength && (
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {value.length}/{maxLength}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
