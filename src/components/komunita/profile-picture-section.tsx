/**
 * Profile Picture Section
 * 
 * Shows profile picture with edit capability for own profile
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StorageAvatar } from '@/components/storage/storage-avatar';
import { PictureUpload } from '@/components/storage/picture-upload';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ProfilePictureSectionProps {
  profileId: string;
  profileName: string | null;
  pictureKey: string | null;
  isOwnProfile: boolean;
  teamColor?: string | null;
  size?: "default" | "sm" | "lg" | "xl" | "2xl";
}

export function ProfilePictureSection({
  profileId,
  profileName,
  pictureKey,
  isOwnProfile,
  teamColor,
  size = "2xl",
}: ProfilePictureSectionProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const router = useRouter();

  const handleUploadComplete = () => {
    setIsEditDialogOpen(false);
    router.refresh();
  };

  return (
    <div className="relative">
      {/* Avatar with team-colored border */}
      <div
        className={cn(
          'rounded-full ring-4 transition-all',
          teamColor ? '' : 'ring-border'
        )}
        style={
          teamColor
            ? ({ '--tw-ring-color': teamColor } as React.CSSProperties)
            : undefined
        }
      >
        <StorageAvatar
          storageKey={pictureKey}
          name={profileName}
          size={size}
        />
      </div>

      {/* Edit button for own profile */}
      {isOwnProfile && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="absolute bottom-0 right-0 rounded-full shadow-lg"
            >
              <Pencil className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Změnit profilový obrázek</DialogTitle>
              <DialogDescription>
                Nahrajte nový profilový obrázek nebo odstraňte stávající.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {pictureKey && (
                <div className="mb-6 flex justify-center">
                  <StorageAvatar
                    storageKey={pictureKey}
                    name={profileName}
                    size="2xl"
                  />
                </div>
              )}
              <PictureUpload
                context="profile"
                entityId={profileId}
                currentPictureKey={pictureKey}
                onUploadComplete={handleUploadComplete}
                onDelete={handleUploadComplete}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
