/**
 * Picture Upload Component
 * 
 * Reusable component for uploading profile/team pictures to B2 storage.
 * Uses presigned PUT URLs for direct browser-to-B2 uploads.
 */

'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { Upload, X, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { StorageContext } from '@/lib/storage/types';

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
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Start upload process
    setIsUploading(true);

    try {
      // Step 1: Get presigned upload URL
      const presignResponse = await fetch('/api/storage/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          entityId,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!presignResponse.ok) {
        const error = await presignResponse.json();
        throw new Error(error.error || 'Nepodařilo se získat URL pro nahrávání');
      }

      const { data: presignData } = await presignResponse.json();

      // Step 2: Upload directly to B2 using PUT
      console.log('Uploading to:', presignData.url);
      console.log('File key:', presignData.key);

      const uploadResponse = await fetch(presignData.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
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

      // Step 3: Confirm upload and update database
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
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadComplete?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Nepodařilo se nahrát obrázek');
      setPreview(null);
    } finally {
      setIsUploading(false);
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
      {preview && (
        <div className="relative w-32 h-32 mx-auto">
          <img
            src={preview}
            alt="Náhled"
            className="w-full h-full object-cover rounded-full"
          />
          {isUploading && (
            <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
        </div>
      )}

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
              {currentPictureKey ? 'Změnit obrázek' : 'Nahrát obrázek'}
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
        Povolené formáty: JPEG, PNG, WebP (max 10MB)
      </p>
    </div>
  );
}
