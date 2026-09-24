'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Upload, Trash2, Globe, Instagram, Linkedin, Building2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { optimizeImageToFit } from '@/lib/storage/image-optimizer';
import { getPublicStorageUrl } from '@/lib/storage/public-url';
import { validateIco } from '@/lib/teams/links';
import type { Team } from '@/lib/komunita/types';

interface TeamEditDialogProps {
  team: Team;
  triggerVariant?: 'default' | 'frosted';
}

export function TeamEditDialog({ team, triggerVariant = 'default' }: TeamEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [logoKey, setLogoKey] = useState<string | null>(team.picture ?? null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    team.picture ? getPublicStorageUrl('avatars', team.picture) : null
  );
  const [groupPictureKey, setGroupPictureKey] = useState<string | null>(team.group_picture ?? null);
  const [groupPicturePreview, setGroupPicturePreview] = useState<string | null>(
    team.group_picture ? getPublicStorageUrl('avatars', team.group_picture) : null
  );

  const [websiteUrl, setWebsiteUrl] = useState(team.website_url ?? '');
  const [instagramUrl, setInstagramUrl] = useState(team.instagram_url ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(team.linkedin_url ?? '');
  const [ico, setIco] = useState(team.ico ?? '');

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingGroupPic, setIsUploadingGroupPic] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const groupPicInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setLogoKey(team.picture ?? null);
    setLogoPreview(team.picture ? getPublicStorageUrl('avatars', team.picture) : null);
    setGroupPictureKey(team.group_picture ?? null);
    setGroupPicturePreview(team.group_picture ? getPublicStorageUrl('avatars', team.group_picture) : null);
    setWebsiteUrl(team.website_url ?? '');
    setInstagramUrl(team.instagram_url ?? '');
    setLinkedinUrl(team.linkedin_url ?? '');
    setIco(team.ico ?? '');
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      resetForm();
    }
  };

  const uploadFile = async (file: File, maxEdge: number): Promise<string> => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      throw new Error('Povolené formáty: JPEG, PNG, WebP');
    }
    if (file.size > 12 * 1024 * 1024) {
      throw new Error('Maximální velikost obrázku je 12 MB');
    }

    const optimized = await optimizeImageToFit(file, {
      maxEdge,
      quality: 0.88,
      format: 'image/webp',
    });

    const presignRes = await fetch('/api/storage/presign-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: 'team',
        entityId: team.id,
        contentType: optimized.type,
        fileSize: optimized.size,
      }),
    });

    if (!presignRes.ok) {
      const err = await presignRes.json().catch(() => null);
      throw new Error(err?.error ?? 'Nepodařilo se připravit nahrání souboru');
    }

    const { data: presignData } = await presignRes.json();

    const uploadRes = await fetch(presignData.url, {
      method: 'PUT',
      body: optimized,
      headers: { 'Content-Type': optimized.type },
    });

    if (!uploadRes.ok) {
      throw new Error('Nahrávání souboru do úložiště selhalo');
    }

    return presignData.key;
  };

  const handleLogoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const key = await uploadFile(file, 800);
      setLogoKey(key);
      setLogoPreview(getPublicStorageUrl('avatars', key));
      toast.success('Logo bylo připraveno k uložení');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nahrávání loga selhalo');
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleGroupPicSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingGroupPic(true);
    try {
      const key = await uploadFile(file, 1920);
      setGroupPictureKey(key);
      setGroupPicturePreview(getPublicStorageUrl('avatars', key));
      toast.success('Společná fotka byla připravena k uložení');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nahrávání fotky selhalo');
    } finally {
      setIsUploadingGroupPic(false);
      if (groupPicInputRef.current) groupPicInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (ico.trim()) {
      const icoCheck = validateIco(ico);
      if (!icoCheck.ok) {
        toast.error(icoCheck.error);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picture: logoKey,
          group_picture: groupPictureKey,
          website_url: websiteUrl,
          instagram_url: instagramUrl,
          linkedin_url: linkedinUrl,
          ico: ico,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Nepodařilo se uložit změny');
      }

      toast.success('Údaje týmu byly úspěšně uloženy.');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Uložení selhalo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerVariant === 'frosted' ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 hover:text-white shadow-lg transition-colors"
          >
            <Pencil className="size-3.5 text-white/80" />
            Upravit tým
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Pencil className="size-3.5" />
            Upravit tým
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upravit informace o týmu</DialogTitle>
          <DialogDescription>
            Aktualizuj logo, společnou fotografii, sociální sítě a oficiální IČO týmu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Logo upload */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Logo týmu</Label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-28 rounded-xl bg-card border border-border/80 p-2 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                {logoPreview ? (
                  <img src={logoPreview} alt="Náhled loga" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="size-6 mx-auto stroke-1" />
                    <span className="text-[10px]">Bez loga</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                  >
                    {isUploadingLogo ? <Spinner className="size-3 mr-1" /> : <Upload className="size-3 mr-1" />}
                    Nahrát logo
                  </Button>
                  {logoKey && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setLogoKey(null);
                        setLogoPreview(null);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Podporuje libovolný tvar a poměr stran (PNG s průhledností, JPEG, WebP).
                </p>
              </div>
            </div>
          </div>

          {/* Group picture upload */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Společná fotografie (cover banner)</Label>
            <div className="space-y-2">
              <div className="relative h-32 w-full rounded-xl bg-muted border border-border/80 overflow-hidden flex items-center justify-center">
                {groupPicturePreview ? (
                  <img src={groupPicturePreview} alt="Náhled fotky týmu" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="size-8 mx-auto stroke-1 mb-1" />
                    <span className="text-xs">Zatím bez společné fotky</span>
                  </div>
                )}
              </div>
              <input
                ref={groupPicInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleGroupPicSelect}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => groupPicInputRef.current?.click()}
                  disabled={isUploadingGroupPic}
                >
                  {isUploadingGroupPic ? <Spinner className="size-3 mr-1" /> : <Upload className="size-3 mr-1" />}
                  Nahrát společnou fotku
                </Button>
                {groupPictureKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setGroupPictureKey(null);
                      setGroupPicturePreview(null);
                    }}
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Odstranit fotku
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Doporučený poměr stran je širokoúhlý (např. 16:9 nebo 21:9).
              </p>
            </div>
          </div>

          {/* Company & Social info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* IČO */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="team-ico" className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="size-3.5 text-muted-foreground" />
                IČO
              </Label>
              <Input
                id="team-ico"
                value={ico}
                onChange={(e) => setIco(e.target.value)}
                placeholder="Např. 12345678"
                maxLength={12}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                8místné identifikační číslo — automaticky vytvoří odkaz na výpis ve Veřejném rejstříku.
              </p>
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <Label htmlFor="team-web" className="text-xs font-semibold flex items-center gap-1.5">
                <Globe className="size-3.5 text-muted-foreground" />
                Webové stránky
              </Label>
              <Input
                id="team-web"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://tuuli.cz"
                className="text-sm"
              />
            </div>

            {/* Instagram */}
            <div className="space-y-1.5">
              <Label htmlFor="team-ig" className="text-xs font-semibold flex items-center gap-1.5">
                <Instagram className="size-3.5 text-muted-foreground" />
                Instagram
              </Label>
              <Input
                id="team-ig"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="@tuuliteam"
                className="text-sm"
              />
            </div>

            {/* LinkedIn */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="team-li" className="text-xs font-semibold flex items-center gap-1.5">
                <Linkedin className="size-3.5 text-muted-foreground" />
                LinkedIn
              </Label>
              <Input
                id="team-li"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/company/tuuliteam"
                className="text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving || isUploadingLogo || isUploadingGroupPic}
          >
            Zrušit
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || isUploadingLogo || isUploadingGroupPic}
          >
            {saving && <Spinner className="size-4 mr-1.5" />}
            Uložit změny
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
