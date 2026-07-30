"use client";

import { useState, useTransition, type ChangeEvent } from "react";

import { uploadArticleImage } from "@/app/(app)/(protected)/contribute/articles/actions";
import { fieldClass as baseFieldClass } from "@/lib/form-styles";
import { FormError } from "@/components/ui/form-error";
import { ImageCropModal } from "@/components/ui/image-crop-modal";

const fieldClass = `w-full ${baseFieldClass}`;

type ImageUrlFieldProps = {
  value: string;
  onChange: (url: string) => void;
  inputId?: string;
  placeholder?: string;
};

// The URL-field-plus-upload-button-plus-preview cluster shared by the
// article cover image field and each image content block -- "upload a
// photo you took yourself" needs the exact same round trip
// (uploadArticleImage -> public URL written back into this field) in both
// places, so this owns it once rather than twice.
export function ImageUrlField({ value, onChange, inputId, placeholder = "Image URL" }: ImageUrlFieldProps) {
  const [isUploading, startUpload] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  // A freshly-picked file (a blob: object URL, revoked once the modal
  // closes) or the already-uploaded `value` (re-cropping a photo that's
  // already been saved) -- either way, cropping happens before anything
  // is uploaded, never after.
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  function uploadBlob(blob: Blob) {
    setUploadError(null);
    startUpload(async () => {
      const formData = new FormData();
      formData.set("file", blob, "cropped.jpg");
      const result = await uploadArticleImage(formData);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      if (result.url) onChange(result.url);
    });
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCropModal() {
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          id={inputId}
          className={`${fieldClass} flex-1`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <label
          className={`inline-flex shrink-0 items-center rounded-pill border border-black/10 px-3 text-sm font-semibold text-zinc-700 transition dark:border-white/10 dark:text-zinc-200 ${
            isUploading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          {isUploading ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>
      {uploadError && <FormError>{uploadError}</FormError>}
      {value ? (
        <div className="flex items-end gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded/external URL, not a local/optimized asset */}
          <img
            src={value}
            alt=""
            className="max-h-40 rounded-lg border border-black/10 object-cover dark:border-white/10"
          />
          <button
            type="button"
            onClick={() => setCropSrc(value)}
            disabled={isUploading}
            className="text-xs font-semibold text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-60 dark:text-zinc-300 dark:decoration-white/20 dark:hover:decoration-white"
          >
            Crop
          </button>
        </div>
      ) : null}
      {cropSrc ? (
        <ImageCropModal
          imageSrc={cropSrc}
          onCancel={closeCropModal}
          onConfirm={(blob) => {
            closeCropModal();
            uploadBlob(blob);
          }}
        />
      ) : null}
    </div>
  );
}
