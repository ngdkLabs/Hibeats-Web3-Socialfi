/**
 * Tip Modal Component
 * 
 * Universal modal for tipping posts, tracks, albums, or artists
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TipTarget } from '@/services/tipService';
import { useTips } from '@/hooks/useTips';
import { toast } from 'sonner';
import { DollarSign, Heart, Music, Album, User } from 'lucide-react';

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: TipTarget;
  targetId: number | string;
  recipientAddress: string;
  recipientName?: string;
  recipientAvatar?: string;
  targetTitle?: string;
}

export const TipModal: React.FC<TipModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  recipientAddress,
  recipientName,
  recipientAvatar,
  targetTitle,
}) => {
  const { sendTip, isSending, parseAmount } = useTips(targetType, targetId);
  
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  // Quick amount buttons
  const quickAmounts = ['0.01', '0.05', '0.1', '0.5', '1'];

  const handleSend = async () => {
    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const amountInWei = parseAmount(amount);
    
    // Validate parsed amount
    if (!amountInWei || amountInWei <= 0) {
      toast.error('Invalid amount format');
      return;
    }

    const success = await sendTip(amountInWei, recipientAddress, message);

    if (success) {
      // Reset form
      setAmount('');
      setMessage('');
      onClose();
    }
  };

  const getIcon = () => {
    switch (targetType) {
      case TipTarget.POST:
        return <Heart className="w-5 h-5" />;
      case TipTarget.TRACK:
        return <Music className="w-5 h-5" />;
      case TipTarget.ALBUM:
        return <Album className="w-5 h-5" />;
      case TipTarget.ARTIST:
        return <User className="w-5 h-5" />;
      default:
        return <DollarSign className="w-5 h-5" />;
    }
  };

  const getTitle = () => {
    switch (targetType) {
      case TipTarget.POST:
        return 'Tip Post';
      case TipTarget.TRACK:
        return 'Support Track';
      case TipTarget.ALBUM:
        return 'Support Album';
      case TipTarget.ARTIST:
        return 'Support Artist';
      default:
        return 'Send Tip';
    }
  };

  const getDescription = () => {
    const name = recipientName || recipientAddress.slice(0, 8);
    switch (targetType) {
      case TipTarget.POST:
        return `Show appreciation for this post by ${name}`;
      case TipTarget.TRACK:
        return `Support ${name} for creating this track`;
      case TipTarget.ALBUM:
        return `Support ${name} for this album`;
      case TipTarget.ARTIST:
        return `Support ${name} to keep creating amazing content`;
      default:
        return `Send a tip to ${name}`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getIcon()}
            <DialogTitle>{getTitle()}</DialogTitle>
          </div>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Avatar className="w-10 h-10">
              <AvatarImage src={recipientAvatar} />
              <AvatarFallback>
                {recipientName?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {recipientName || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {recipientAddress}
              </p>
            </div>
          </div>

          {/* Target Title (if provided) */}
          {targetTitle && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">For:</span> {targetTitle}
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (STT)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            
            {/* Quick Amount Buttons */}
            <div className="flex gap-2 flex-wrap">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(quickAmount)}
                >
                  {quickAmount} STT
                </Button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a message to your tip..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/200
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!amount || parseFloat(amount) <= 0 || isSending}
            className="flex-1"
          >
            {isSending ? 'Sending...' : `Send ${amount || '0'} STT`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TipModal;
