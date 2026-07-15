import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { fbStorage } from "./firebase";

export async function uploadFile(
  path: string,
  file: File | Blob,
): Promise<{ url: string; path: string }> {
  const r = ref(fbStorage(), path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  return { url, path };
}

export async function deleteFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(fbStorage(), path));
  } catch {
    // ignore missing
  }
}

// Convert a Firebase storage URL (or any http image) to a data URL for jsPDF.
// Tries a plain fetch first; if that's blocked (e.g. a CORS-restricted bucket),
// falls back to loading via an <img> + <canvas>, which works in more cases.
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch (fetchErr) {
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("no 2d context");
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error("image load failed"));
        img.src = url;
      });
    } catch (canvasErr) {
      console.warn("urlToDataUrl: could not load image for PDF", url, fetchErr, canvasErr);
      return null;
    }
  }
}
