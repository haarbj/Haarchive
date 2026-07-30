"use client";

import { useState, useTransition, type ChangeEvent } from "react";

import { uploadArticleImage } from "@/app/(app)/(protected)/contribute/articles/actions";
import { fieldClass as baseFieldClass } from "@/lib/form-styles";
import { FormError } from "@/components/ui/form-error";

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

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    startUpload(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadArticleImage(formData);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      if (result.url) onChange(result.url);
    });
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
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded/external URL, not a local/optimized asset
        <img
          src={value}
          alt=""
          className="max-h-40 rounded-lg border border-black/10 object-cover dark:border-white/10"
        />
      ) : null}
    </div>
  );
}
