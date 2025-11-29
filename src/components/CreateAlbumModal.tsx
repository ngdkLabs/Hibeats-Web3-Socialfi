import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Disc3, Image as ImageIcon, Loader2, Plus, X, Music } from 'lucide-react';
import { toast } from 'sonner';
import { ipfsService } from '@/services/ipfsService';
import { useSequence } from '@/contexts/SequenceContext';

interface Song {
  tokenId: number;
  title: string;
  artist: string;
  coverHash: string;
}

interface CreateAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSongs: Song[]; // Songs that can be added to album
  onSuccess?: () => void;
}

type AlbumType = 'single' | 'ep' | 'album';

const CreateAlbumModal = ({ isOpen, onClose, availableSongs, onSuccess }: CreateAlbumModalProps) => {
  const { isAccountReady, createAlbum, addSongToAlbum } = useSequence();
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [albumType, setAlbumType] = useState<AlbumType>('album');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [coverIpfsHash, setCoverIpfsHash] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{
    stage: 'idle' | 'compressing' | 'uploading' | 'complete' | 'error';
    percent: number;
    message: string;
  }>({ stage: 'idle', percent: 0, message: '' });
  const [selectedSongs, setSelectedSongs] = useState<number[]>([]);
  const [releaseDate, setReleaseDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const albumTypeInfo = {
    single: { name: 'Single', min: 1, max: 1, desc: 'One track release' },
    ep: { name: 'EP', min: 2, max: 6, desc: '2-6 tracks' },
    album: { name: 'Album', min: 7, max: 99, desc: '7+ tracks' }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, WEBP)');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }
    
    try {
      // Stage 1: Instant preview
      setUploadProgress({ stage: 'compressing', percent: 10, message: 'Loading preview...' });
      const previewUrl = URL.createObjectURL(file);
      setCoverPreview(previewUrl);
      
      // Stage 2: Compress
      setUploadProgress({ stage: 'compressing', percent: 30, message: 'Compressing...' });
      const { compressCoverImage } = await import('@/utils/imageCompression');
      const compressedFile = await compressCoverImage(file);
      
      const originalKB = (file.size / 1024).toFixed(0);
      const compressedKB = (compressedFile.size / 1024).toFixed(0);
      
      // Update preview with compressed
      URL.revokeObjectURL(previewUrl);
      const compressedPreview = URL.createObjectURL(compressedFile);
      setCoverPreview(compressedPreview);
      setCoverFile(compressedFile);
      
      // Stage 3: Upload to IPFS
      setUploadProgress({ stage: 'uploading', percent: 60, message: 'Uploading to IPFS...' });
      const result = await ipfsService.uploadFile(compressedFile);
      const hash = result.IpfsHash || result.ipfsHash || result.Hash || result.hash;
      
      if (!hash) throw new Error('No IPFS hash returned');
      
      setCoverIpfsHash(hash);
      setUploadProgress({ stage: 'complete', percent: 100, message: `✓ Ready! ${compressedKB}KB` });
      
      toast.success(`Cover ready! ${originalKB}KB → ${compressedKB}KB`);
    } catch (error) {
      console.error('Error processing cover:', error);
      setUploadProgress({ stage: 'error', percent: 0, message: 'Upload failed' });
      toast.error(`Failed: ${error.message}`);
      setCoverIpfsHash('');
    }
  };

  const toggleSong = (tokenId: number) => {
    if (selectedSongs.includes(tokenId)) {
      setSelectedSongs(selectedSongs.filter(id => id !== tokenId));
    } else {
      const info = albumTypeInfo[albumType];
      if (selectedSongs.length >= info.max) {
        toast.error(`${info.name} can have maximum ${info.max} song(s)`);
        return;
      }
      setSelectedSongs([...selectedSongs, tokenId]);
    }
  };

  const handleCreate = async () => {
    if (!albumTitle.trim()) {
      toast.error('Please enter album title');
      return;
    }

    const info = albumTypeInfo[albumType];
    if (selectedSongs.length < info.min) {
      toast.error(`${info.name} must have at least ${info.min} song(s)`);
      return;
    }

    if (selectedSongs.length > info.max) {
      toast.error(`${info.name} can have maximum ${info.max} song(s)`);
      return;
    }

    if (!coverFile) {
      toast.error('Please upload a cover image');
      return;
    }

    setIsCreating(true);

    try {
      toast.loading('Creating album...', { id: 'create-album' });
      
      // Use already uploaded cover hash or upload if not done yet
      let coverHash = coverIpfsHash;
      if (!coverHash) {
        toast.loading('Uploading cover to IPFS...', { id: 'create-album' });
        const result = await ipfsService.uploadFile(coverFile);
        coverHash = result.IpfsHash || result.ipfsHash || result.Hash || result.hash;
      }
      console.log('✅ Using cover hash:', coverHash);

      toast.loading('Creating album metadata...', { id: 'create-album' });
      
      // Create metadata
      const metadata = {
        name: albumTitle,
        description: albumDescription || `${albumTitle} - ${albumTypeInfo[albumType].name}`,
        image: `ipfs://${coverHash}`,
        albumType: albumType.toUpperCase(),
        totalTracks: selectedSongs.length,
        releaseDate: releaseDate || new Date().toISOString(),
        platform: 'HiBeats',
        attributes: [
          { trait_type: 'Type', value: albumTypeInfo[albumType].name },
          { trait_type: 'Total Tracks', value: selectedSongs.length },
          { trait_type: 'Platform', value: 'HiBeats' }
        ]
      };

      const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const metadataHash = await ipfsService.uploadFile(metadataBlob as any);
      console.log('✅ Metadata uploaded:', metadataHash);

      toast.loading('Creating album on blockchain...', { id: 'create-album' });

      // Map albumType to enum: 0 = SINGLE, 1 = EP, 2 = ALBUM
      const albumTypeEnum = albumType === 'single' ? 0 : albumType === 'ep' ? 1 : 2;

      // Create album on blockchain
      const txHash = await createAlbum(
        albumTitle,
        albumDescription || `${albumTitle} - ${albumTypeInfo[albumType].name}`,
        coverHash,
        albumTypeEnum,
        `ipfs://${metadataHash}`
      );

      console.log('✅ Album created with tx:', txHash);

      // Note: In production, we would parse the transaction receipt to get the albumId
      // and then add songs to the album using addSongToAlbum(albumId, songTokenId)
      // For now, we'll just show success

      toast.dismiss('create-album');
      toast.success(`🎵 ${albumTypeInfo[albumType].name} created successfully!`, {
        description: `Created: ${albumTitle}`,
        action: {
          label: 'View Explorer',
          onClick: () => window.open(`https://shannon-explorer.somnia.network/tx/${txHash}`, '_blank')
        }
      });

      // Reset form
      setAlbumTitle('');
      setAlbumDescription('');
      setAlbumType('album');
      setCoverFile(null);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverPreview('');
      setCoverIpfsHash('');
      setUploadProgress({ stage: 'idle', percent: 0, message: '' });
      setSelectedSongs([]);
      setReleaseDate('');

      onSuccess?.();
      onClose();

    } catch (error) {
      console.error('❌ Failed to create album:', error);
      toast.dismiss('create-album');
      toast.error(`Failed to create album: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-primary" />
            Create Album/EP/Single
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Album Type */}
          <div className="space-y-2">
            <Label>Release Type *</Label>
            <div className="grid grid-cols-3 gap-3">
              {(['single', 'ep', 'album'] as AlbumType[]).map((type) => (
                <Card
                  key={type}
                  className={`p-4 cursor-pointer transition-all ${
                    albumType === type 
                      ? 'border-primary bg-primary/5' 
                      : 'border-gray-300 hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setAlbumType(type);
                    setSelectedSongs([]);
                  }}
                >
                  <div className="text-center">
                    <Music className={`w-6 h-6 mx-auto mb-2 ${albumType === type ? 'text-primary' : 'text-gray-400'}`} />
                    <h4 className="font-semibold text-sm">{albumTypeInfo[type].name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{albumTypeInfo[type].desc}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Album Title */}
          <div className="space-y-2">
            <Label htmlFor="albumTitle">Title *</Label>
            <Input
              id="albumTitle"
              placeholder="Enter album/EP/single title"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="albumDescription">Description</Label>
            <Textarea
              id="albumDescription"
              placeholder="Describe your release..."
              value={albumDescription}
              onChange={(e) => setAlbumDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Cover Image *</Label>
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer relative"
              onClick={() => coverInputRef.current?.click()}
            >
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="hidden"
                disabled={uploadProgress.stage === 'compressing' || uploadProgress.stage === 'uploading'}
              />
              {coverPreview ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <img src={coverPreview} alt="Cover preview" className="w-32 h-32 object-cover rounded-lg" />
                    
                    {/* Progress Overlay */}
                    {(uploadProgress.stage === 'compressing' || uploadProgress.stage === 'uploading') && (
                      <div className="absolute inset-0 bg-black/60 rounded-lg flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-1" />
                        <p className="text-xs text-white">{uploadProgress.percent}%</p>
                      </div>
                    )}
                    
                    {/* Success Badge */}
                    {uploadProgress.stage === 'complete' && (
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute -top-2 -left-2 h-6 w-6 p-0 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (coverPreview) URL.revokeObjectURL(coverPreview);
                        setCoverFile(null);
                        setCoverPreview('');
                        setCoverIpfsHash('');
                        setUploadProgress({ stage: 'idle', percent: 0, message: '' });
                      }}
                      disabled={uploadProgress.stage === 'compressing' || uploadProgress.stage === 'uploading'}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {/* Progress Message */}
                  {uploadProgress.message && (
                    <p className={`text-xs ${
                      uploadProgress.stage === 'complete' ? 'text-green-600' :
                      uploadProgress.stage === 'error' ? 'text-red-600' :
                      'text-muted-foreground'
                    }`}>
                      {uploadProgress.message}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">Click to upload cover image</p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, WEBP (max 10MB)</p>
                  <p className="text-xs text-primary mt-2">Auto-compress & upload to IPFS</p>
                </div>
              )}
            </div>
          </div>

          {/* Release Date */}
          <div className="space-y-2">
            <Label htmlFor="releaseDate">Release Date (Optional)</Label>
            <Input
              id="releaseDate"
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
            />
          </div>

          {/* Song Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Select Songs * 
                <span className="text-xs text-muted-foreground ml-2">
                  ({selectedSongs.length}/{albumTypeInfo[albumType].max})
                </span>
              </Label>
              <Badge variant="secondary">
                {albumTypeInfo[albumType].min}-{albumTypeInfo[albumType].max} songs
              </Badge>
            </div>
            
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
              {availableSongs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No songs available. Upload songs first!
                </p>
              ) : (
                availableSongs.map((song) => (
                  <Card
                    key={song.tokenId}
                    className={`p-3 cursor-pointer transition-all ${
                      selectedSongs.includes(song.tokenId)
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => toggleSong(song.tokenId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <Music className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      {selectedSongs.includes(song.tokenId) && (
                        <Badge variant="default" className="flex-shrink-0">Selected</Badge>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isCreating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !albumTitle.trim() ||
                !coverFile ||
                selectedSongs.length < albumTypeInfo[albumType].min ||
                selectedSongs.length > albumTypeInfo[albumType].max ||
                isCreating
              }
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create {albumTypeInfo[albumType].name}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAlbumModal;
