/**
 * Media Upload Component for Images/Videos
 */

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip, X, Image as ImageIcon, Video } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface MediaUploadProps {
  onMediaSelect: (file: File, type: 'image' | 'video') => void
}

export default function MediaUpload({ onMediaSelect }: MediaUploadProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const handleImageClick = () => {
    imageInputRef.current?.click()
  }

  const handleVideoClick = () => {
    videoInputRef.current?.click()
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        // Compress image before sending
        const { compressPostImage } = await import('@/utils/imageCompression');
        const compressedFile = await compressPostImage(file);
        console.log(`📷 Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
        onMediaSelect(compressedFile, 'image')
      } catch (error) {
        console.error('Error compressing image:', error);
        // Fallback to original file
        onMediaSelect(file, 'image')
      }
    }
  }

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onMediaSelect(file, 'video')
    }
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="flex-shrink-0 text-gray-400 hover:text-white hover:bg-gray-800">
            <Paperclip className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 bg-gray-900 border-gray-800 p-2" align="start">
          <div className="flex flex-col gap-1">
            <button
              onClick={handleImageClick}
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
            >
              <ImageIcon className="w-4 h-4 text-purple-400" />
              <span>Image</span>
            </button>
            <button
              onClick={handleVideoClick}
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
            >
              <Video className="w-4 h-4 text-pink-400" />
              <span>Video</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoChange}
        className="hidden"
      />
    </>
  )
}

interface MediaPreviewProps {
  file: File
  type: 'image' | 'video'
  onRemove: () => void
}

export function MediaPreview({ file, type, onRemove }: MediaPreviewProps) {
  const [preview, setPreview] = useState<string>('')

  // Generate preview URL
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="relative inline-block mb-2">
      <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-gray-800">
        {type === 'image' ? (
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <video src={preview} className="w-full h-full object-cover" />
        )}
      </div>
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
      >
        <X className="w-4 h-4 text-white" />
      </button>
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white">
        {type === 'image' ? <ImageIcon className="w-3 h-3" /> : <Video className="w-3 h-3" />}
      </div>
    </div>
  )
}
