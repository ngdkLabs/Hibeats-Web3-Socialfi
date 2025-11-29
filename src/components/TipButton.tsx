/**
 * Tip Button Component
 * 
 * Simple button to trigger tip modal
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TipModal } from './TipModal';
import { TipTarget } from '@/services/tipService';
import { DollarSign, Heart } from 'lucide-react';

interface TipButtonProps {
  targetType: TipTarget;
  targetId: number | string;
  recipientAddress: string;
  recipientName?: string;
  recipientAvatar?: string;
  targetTitle?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
}

export const TipButton: React.FC<TipButtonProps> = ({
  targetType,
  targetId,
  recipientAddress,
  recipientName,
  recipientAvatar,
  targetTitle,
  variant = 'outline',
  size = 'default',
  showIcon = true,
  showText = true,
  className = '',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getButtonText = () => {
    switch (targetType) {
      case TipTarget.POST:
        return 'Tip';
      case TipTarget.TRACK:
      case TipTarget.ALBUM:
      case TipTarget.ARTIST:
        return 'Support';
      default:
        return 'Tip';
    }
  };

  const getIcon = () => {
    if (targetType === TipTarget.POST) {
      return <Heart className="w-4 h-4" />;
    }
    return <DollarSign className="w-4 h-4" />;
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        className={className}
      >
        {showIcon && getIcon()}
        {showText && <span>{getButtonText()}</span>}
      </Button>

      <TipModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetType={targetType}
        targetId={targetId}
        recipientAddress={recipientAddress}
        recipientName={recipientName}
        recipientAvatar={recipientAvatar}
        targetTitle={targetTitle}
      />
    </>
  );
};

export default TipButton;
