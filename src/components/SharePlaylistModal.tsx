import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Twitter, Facebook, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SharePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: {
    id: string;
    title: string;
    description: string;
  };
}

export default function SharePlaylistModal({ isOpen, onClose, playlist }: SharePlaylistModalProps) {
  const [copied, setCopied] = useState(false);

  // Generate shareable URL
  const shareUrl = `${window.location.origin}/playlist/${playlist.id}`;
  
  // Share text
  const shareText = `Check out "${playlist.title}" playlist on HiBeats! 🎵`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const handleShareFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank', 'width=550,height=420');
  };

  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: playlist.title,
          text: shareText,
          url: shareUrl,
        });
        toast.success('Shared successfully!');
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Share Playlist</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Playlist Info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">{playlist.title}</h3>
            {playlist.description && (
              <p className="text-sm text-gray-400 line-clamp-2">{playlist.description}</p>
            )}
          </div>

          {/* Copy Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Share Link</label>
            <div className="flex gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="bg-gray-800 border-gray-700 text-white flex-1"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="border-gray-700 hover:bg-gray-800 flex-shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Share to</label>
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={handleShareTwitter}
                variant="outline"
                className="border-gray-700 hover:bg-gray-800 gap-2"
              >
                <Twitter className="w-4 h-4" />
                <span className="hidden sm:inline">Twitter</span>
              </Button>
              
              <Button
                onClick={handleShareFacebook}
                variant="outline"
                className="border-gray-700 hover:bg-gray-800 gap-2"
              >
                <Facebook className="w-4 h-4" />
                <span className="hidden sm:inline">Facebook</span>
              </Button>
              
              <Button
                onClick={handleShareWhatsApp}
                variant="outline"
                className="border-gray-700 hover:bg-gray-800 gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </Button>
            </div>
          </div>

          {/* Native Share (Mobile) */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              onClick={handleNativeShare}
              className="w-full bg-primary hover:bg-primary/90"
            >
              Share via...
            </Button>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
