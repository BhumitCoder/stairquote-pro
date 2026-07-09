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
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
