// The standard react-easy-crop canvas recipe: draw only the selected pixel
// rectangle onto a canvas sized to match, then export it. crossOrigin is
// required for an already-uploaded (cross-origin) Supabase Storage URL --
// without it the canvas is "tainted" and toBlob throws instead of exporting.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't load the image."));
    image.src = src;
  });
}

export type PixelCrop = { x: number; y: number; width: number; height: number };

// Always re-encodes as JPEG regardless of the source format -- these are
// photos, not graphics needing a transparent background, and a canvas
// round-trip can't preserve an animated GIF's frames anyway.
export async function getCroppedImageBlob(imageSrc: string, crop: PixelCrop): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Couldn't export the cropped image."));
      },
      "image/jpeg",
      0.92,
    );
  });
}
