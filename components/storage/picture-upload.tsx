/**
 * Picture Upload Component
 * 
 * Reusable component for uploading profile/team pictures to B2 storage.
 * Uses presigned PUT URLs for direct browser-to-B2 uploads.
 * Includes professional image cropping with zoom functionality.
 */

'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { Upload, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { StorageContext } from '@/lib/storage/types';
import { optimizeImage } from '@/lib/storage/image-optimizer';
import { ImageCropDialog } from './image-crop-dialog';

interface PictureUploadProps {
  context: StorageContext;
  entityId: string;
  currentPictureKey?: string | null;
  onUploadComplete?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function PictureUpload({
  context,
  entityId,
  currentPictureKey,
  onUploadComplete,
  onDelete,
  className,
}: PictureUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Povolené formáty: JPEG, PNG, WebP');
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Maximální velikost souboru je 10MB');
      return;
    }

    // Create data URL for crop dialog
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setRawImageSrc(dataUrl);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedFile: File) => {
    // Close dialog and start upload process
    setCropDialogOpen(false);
    setRawImageSrc(null);
    setIsUploading(true);

    try {
      // Step 1: Optimize the cropped image
      const optimized = await optimizeImage(croppedFile);

      // Step 2: Get presigned upload URL
      const presignResponse = await fetch('/api/storage/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          entityId,
          contentType: optimized.type,
          fileSize: optimized.size,
        }),
      });

      if (!presignResponse.ok) {
        const error = await presignResponse.json();
        throw new Error(error.error || 'Nepodařilo se získat URL pro nahrávání');
      }

      const { data: presignData } = await presignResponse.json();

      // Step 3: Upload directly to B2 using PUT
      const uploadResponse = await fetch(presignData.url, {
        method: 'PUT',
        body: optimized,
        headers: {
          'Content-Type': optimized.type,
        },
        mode: 'cors',
      }).catch((err) => {
        console.error('Fetch error:', err);
        throw new Error(`CORS nebo síťová chyba: ${err.message}`);
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload failed:', uploadResponse.status, errorText);
        throw new Error(`Nahrávání selhalo (${uploadResponse.status}): ${errorText}`);
      }

      // Step 4: Confirm upload and update database
      const confirmResponse = await fetch('/api/storage/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          entityId,
          key: presignData.key,
          deleteOldKey: currentPictureKey,
        }),
      });

      if (!confirmResponse.ok) {
        const error = await confirmResponse.json();
        throw new Error(error.error || 'Nepodařilo se potvrdit nahrání');
      }

      toast.success('Obrázek byl úspěšně nahrán');
      onUploadComplete?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Nepodařilo se nahrát obrázek');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!currentPictureKey) return;

    setIsDeleting(true);

    try {
      const response = await fetch('/api/storage/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          entityId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Nepodařilo se smazat obrázek');
      }

      toast.success('Obrázek byl smazán');
      onDelete?.();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Nepodařilo se smazat obrázek');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex gap-2 justify-center">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isDeleting}
          variant="outline"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Nahrávání...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              {currentPictureKey ? 'Změnit obrázek' : 'Vybrat obrázek'}
            </>
          )}
        </Button>

        {currentPictureKey && (
          <Button
            onClick={handleDelete}
            disabled={isUploading || isDeleting}
            variant="outline"
            size="icon"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="text-xs text-muted-foreground text-center">
        JPEG, PNG, WebP (max 10MB)
      </p>

      {/* Image Crop Dialog */}
      {rawImageSrc && (
        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={(open) => {
            setCropDialogOpen(open);
            if (!open) {
              setRawImageSrc(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }
          }}
          imageSrc={rawImageSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
