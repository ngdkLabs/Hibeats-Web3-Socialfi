/**
 * Chat Customization Modal
 * 
 * Modal untuk customize chat background dan bubble color
 * Mirip dengan WhatsApp customization
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Image as ImageIcon, Check } from 'lucide-react';

interface ChatCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  onSave: (settings: ChatCustomization) => void;
  currentSettings?: ChatCustomization;
}

export interface ChatCustomization {
  backgroundColor?: string;
  backgroundImage?: string;
  bubbleColor?: string;
}

// Predefined backgrounds
const BACKGROUND_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Light Gray', value: '#f0f2f5' },
  { name: 'Dark Gray', value: '#1a1a1a' },
  { name: 'Blue', value: '#e3f2fd' },
  { name: 'Green', value: '#e8f5e9' },
  { name: 'Purple', value: '#f3e5f5' },
  { name: 'Pink', value: '#fce4ec' },
  { name: 'Orange', value: '#fff3e0' },
];

const BACKGROUND_PATTERNS = [
  { name: 'None', value: '' },
  { name: 'WhatsApp Classic', value: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%23e5ddd5\'/%3E%3Cpath d=\'M20 20h60v60H20z\' fill=\'%23fff\' opacity=\'.1\'/%3E%3C/svg%3E")' },
  { name: 'Dots', value: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)' },
  { name: 'Lines', value: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)' },
];

// Predefined bubble colors
const BUBBLE_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Blue', value: '#0084ff' },
  { name: 'Green', value: '#25d366' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Teal', value: '#14b8a6' },
];

export function ChatCustomizationModal({
  isOpen,
  onClose,
  conversationId,
  onSave,
  currentSettings = {},
}: ChatCustomizationModalProps) {
  const [backgroundColor, setBackgroundColor] = useState(currentSettings.backgroundColor || '');
  const [backgroundImage, setBackgroundImage] = useState(currentSettings.backgroundImage || '');
  const [bubbleColor, setBubbleColor] = useState(currentSettings.bubbleColor || '');
  const [customBgColor, setCustomBgColor] = useState('');
  const [customBubbleColor, setCustomBubbleColor] = useState('');

  useEffect(() => {
    if (currentSettings) {
      setBackgroundColor(currentSettings.backgroundColor || '');
      setBackgroundImage(currentSettings.backgroundImage || '');
      setBubbleColor(currentSettings.bubbleColor || '');
    }
  }, [currentSettings]);

  const handleSave = () => {
    const settings: ChatCustomization = {
      backgroundColor: customBgColor || backgroundColor,
      backgroundImage,
      bubbleColor: customBubbleColor || bubbleColor,
    };
    onSave(settings);
    onClose();
  };

  const handleReset = () => {
    setBackgroundColor('');
    setBackgroundImage('');
    setBubbleColor('');
    setCustomBgColor('');
    setCustomBubbleColor('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Chat</DialogTitle>
          <DialogDescription>
            Personalize your chat with custom backgrounds and colors
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="background" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="background">Background</TabsTrigger>
            <TabsTrigger value="bubble">Bubble Color</TabsTrigger>
          </TabsList>

          <TabsContent value="background" className="space-y-4">
            {/* Solid Colors */}
            <div className="space-y-2">
              <Label>Solid Colors</Label>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      setBackgroundColor(color.value);
                      setBackgroundImage('');
                      setCustomBgColor('');
                    }}
                    className={`h-12 rounded-md border-2 transition-all ${
                      backgroundColor === color.value && !customBgColor
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                    style={{ backgroundColor: color.value || '#ffffff' }}
                    title={color.name}
                  >
                    {backgroundColor === color.value && !customBgColor && (
                      <Check className="w-4 h-4 mx-auto text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Patterns */}
            <div className="space-y-2">
              <Label>Patterns</Label>
              <div className="grid grid-cols-2 gap-2">
                {BACKGROUND_PATTERNS.map((pattern) => (
                  <button
                    key={pattern.name}
                    onClick={() => {
                      setBackgroundImage(pattern.value);
                      setCustomBgColor('');
                    }}
                    className={`h-16 rounded-md border-2 transition-all ${
                      backgroundImage === pattern.value
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                    style={{ 
                      background: pattern.value || '#ffffff',
                      backgroundSize: '20px 20px'
                    }}
                  >
                    <span className="text-xs font-medium">{pattern.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Color Picker */}
            <div className="space-y-2">
              <Label htmlFor="custom-bg">Custom Color</Label>
              <div className="flex gap-2">
                <input
                  id="custom-bg"
                  type="color"
                  value={customBgColor || backgroundColor || '#ffffff'}
                  onChange={(e) => {
                    setCustomBgColor(e.target.value);
                    setBackgroundColor('');
                    setBackgroundImage('');
                  }}
                  className="w-full h-10 rounded-md border cursor-pointer"
                />
                <input
                  type="text"
                  value={customBgColor || backgroundColor}
                  onChange={(e) => {
                    setCustomBgColor(e.target.value);
                    setBackgroundColor('');
                  }}
                  placeholder="#ffffff"
                  className="w-24 h-10 px-2 rounded-md border text-sm"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bubble" className="space-y-4">
            {/* Predefined Bubble Colors */}
            <div className="space-y-2">
              <Label>Bubble Colors</Label>
              <div className="grid grid-cols-4 gap-2">
                {BUBBLE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      setBubbleColor(color.value);
                      setCustomBubbleColor('');
                    }}
                    className={`h-12 rounded-md border-2 transition-all ${
                      bubbleColor === color.value && !customBubbleColor
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                    style={{ backgroundColor: color.value || '#0084ff' }}
                    title={color.name}
                  >
                    {bubbleColor === color.value && !customBubbleColor && (
                      <Check className="w-4 h-4 mx-auto text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Bubble Color Picker */}
            <div className="space-y-2">
              <Label htmlFor="custom-bubble">Custom Bubble Color</Label>
              <div className="flex gap-2">
                <input
                  id="custom-bubble"
                  type="color"
                  value={customBubbleColor || bubbleColor || '#0084ff'}
                  onChange={(e) => {
                    setCustomBubbleColor(e.target.value);
                    setBubbleColor('');
                  }}
                  className="w-full h-10 rounded-md border cursor-pointer"
                />
                <input
                  type="text"
                  value={customBubbleColor || bubbleColor}
                  onChange={(e) => {
                    setCustomBubbleColor(e.target.value);
                    setBubbleColor('');
                  }}
                  placeholder="#0084ff"
                  className="w-24 h-10 px-2 rounded-md border text-sm"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-4 rounded-lg border bg-muted">
                <div className="flex justify-end mb-2">
                  <div
                    className="px-3 py-2 rounded-lg text-white text-sm max-w-[70%]"
                    style={{ backgroundColor: customBubbleColor || bubbleColor || '#0084ff' }}
                  >
                    Your message
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-lg bg-muted-foreground/10 text-sm max-w-[70%]">
                    Their message
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={handleReset}>
            Reset
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
