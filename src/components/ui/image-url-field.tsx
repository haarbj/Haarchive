"use client";

import { useState, useTransition, type ChangeEvent } from "react";

import { fieldClass as baseFieldClass } from "@/lib/form-styles";
import { FormError } from "@/components/ui/form-error";
import { ImageCropModal } from "@/components/ui/image-crop-modal";

const fieldClass = `w-full ${baseFieldClass}`;

export type ImageUploadAction = (formData: FormData) => Promise<{ url?: string; error?: string }>;

type ImageUrlFieldProps = {
  value: string;
  onChange: (url: string) => void;
  // Pluggable rather than hardcoded to one action -- different call sites
  // upload to different places under different permission rules (an
  // article image vs. a personal avatar), but want the exact same picker
  // + crop UI either way.
  uploadAction: ImageUploadAction;
  inputId?: string;
  placeholder?: string;
};

// The URL-field-plus-upload-button-plus-preview cluster shared by every
// "paste a URL or upload a photo" field on the site -- article cover
// images, in-body image blocks, and profile avatars all need the exact
// same round trip (upload -> public URL written back into this field), so
// this owns it once rather than once per call site.
export function ImageUrlField({ value, onChange, uploadAction, inputId, placeholder = "Image URL" }: ImageUrlFieldProps) {
  const [isUploading, startUpload] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  // A freshly-picked file (a blob: object URL, revoked once the modal
  // closes) or the already-uploaded `value` (re-cropping a photo that's
  // already been saved).
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  // Kept alongside cropSrc so "Use original" (skipping the crop) can still
  // upload the file the user actually picked -- only set when cropSrc came
  // from a fresh file selection, not from re-cropping an existing `value`.
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function uploadFile(file: Blob, filename: string) {
    setUploadError(null);
    startUpload(async () => {
      const formData = new FormData();
      formData.set("file", file, filename);
      const result = await uploadAction(formData);
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
    setPendingFile(file);
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCropModal() {
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setPendingFile(null);
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
            uploadFile(blob, "cropped.jpg");
          }}
          onSkip={
            pendingFile
              ? () => {
                  const file = pendingFile;
                  closeCropModal();
                  uploadFile(file, file.name);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
