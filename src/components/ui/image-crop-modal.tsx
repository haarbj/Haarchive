"use client";

import { useState } from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import { X, ZoomIn } from "lucide-react";

import { getCroppedImageBlob } from "@/lib/image-crop";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

const ASPECT_PRESETS = [
  { label: "Wide", ratio: 16 / 9 },
  { label: "Square", ratio: 1 },
  { label: "Tall", ratio: 4 / 5 },
];

type ImageCropModalProps = {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  // Only offered when cropping a freshly-picked file (see ImageUrlField) --
  // uploads it exactly as selected, no forced crop. Not offered when
  // re-cropping an already-uploaded photo, since there's nothing meaningful
  // to "use as-is" there beyond just cancelling.
  onSkip?: () => void;
};

// A photo's natural framing rarely matches the fixed-height band it
// actually renders in (the hero image especially -- object-cover just
// grabs the center by default, which can cut off the actual subject). This
// lets a contributor choose what shows instead of leaving it to chance --
// but it's an option, not a requirement, hence onSkip. Shared by both the
// cover image field and each in-body image block (see ImageUrlField), for
// a freshly-picked file and an already-uploaded one alike.
export function ImageCropModal({ imageSrc, onCancel, onConfirm, onSkip }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleMediaLoaded(mediaSize: MediaSize) {
    const ratio = mediaSize.naturalWidth / mediaSize.naturalHeight;
    setNaturalAspect(ratio);
    setAspect(ratio);
  }

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } catch {
      setError("Couldn't crop this image -- its host may not allow it. Try uploading it fresh instead.");
      setIsProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-card border border-black/10 bg-white shadow-modal dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Crop photo</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel crop"
            className="text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-80 bg-black">
          {aspect ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onMediaLoaded={handleMediaLoaded}
              onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
            />
          ) : null}
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center gap-2">
            <ZoomIn className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="w-full accent-zinc-900 dark:accent-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {naturalAspect ? (
              <Button
                type="button"
                variant={aspect === naturalAspect ? "solid" : "outline"}
                size="sm"
                onClick={() => setAspect(naturalAspect)}
              >
                Original
              </Button>
            ) : null}
            {ASPECT_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant={aspect === preset.ratio ? "solid" : "outline"}
                size="sm"
                onClick={() => setAspect(preset.ratio)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {error ? <FormError>{error}</FormError> : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            {onSkip ? (
              <Button type="button" variant="outline" onClick={onSkip} disabled={isProcessing}>
                Use original
              </Button>
            ) : null}
            <Button type="button" onClick={handleConfirm} disabled={isProcessing || !croppedAreaPixels}>
              {isProcessing ? "Cropping…" : "Apply crop"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
