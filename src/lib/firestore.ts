import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { fbDb } from "./firebase";
import type { AppSettings, Client, Quotation } from "./types";
import { DEFAULT_SETTINGS } from "./settings-defaults";
import { todayKey } from "./format";

function userRoot(uid: string) {
  return doc(fbDb(), "users", uid);
}

// ============ Settings ============
export async function getSettings(uid: string): Promise<AppSettings> {
  const snap = await getDoc(doc(fbDb(), "users", uid, "meta", "settings"));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(snap.data() as AppSettings) };
}

export async function saveSettings(uid: string, s: AppSettings): Promise<void> {
  await setDoc(doc(fbDb(), "users", uid, "meta", "settings"), s);
  // ensure user root exists
  await setDoc(userRoot(uid), { updatedAt: serverTimestamp() }, { merge: true });
}

// ============ Clients ============
export async function listClients(uid: string): Promise<Client[]> {
  const q = query(
    collection(fbDb(), "users", uid, "clients"),
    orderBy("name"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, "id">) }));
}

export async function getClient(uid: string, id: string): Promise<Client | null> {
  const snap = await getDoc(doc(fbDb(), "users", uid, "clients", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Client, "id">) };
}

export async function saveClient(
  uid: string,
  client: Omit<Client, "id"> & { id?: string },
): Promise<string> {
  if (client.id) {
    const { id, ...rest } = client;
    await updateDoc(doc(fbDb(), "users", uid, "clients", id), rest);
    return id;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...clientData } = client;
  const ref = await addDoc(collection(fbDb(), "users", uid, "clients"), {
    ...clientData,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteClient(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(fbDb(), "users", uid, "clients", id));
}

// ============ Quotations ============
export async function listQuotations(uid: string): Promise<Quotation[]> {
  const q = query(
    collection(fbDb(), "users", uid, "quotations"),
    orderBy("date", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Quotation, "id">) }));
}

export async function listQuotationsByClient(
  uid: string,
  clientId: string,
): Promise<Quotation[]> {
  const q = query(
    collection(fbDb(), "users", uid, "quotations"),
    where("clientId", "==", clientId),
    orderBy("date", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Quotation, "id">) }));
}

export async function getQuotation(uid: string, id: string): Promise<Quotation | null> {
  const snap = await getDoc(doc(fbDb(), "users", uid, "quotations", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Quotation, "id">) };
}

export async function saveQuotation(
  uid: string,
  quote: Omit<Quotation, "id"> & { id?: string },
): Promise<string> {
  if (quote.id) {
    const { id, ...rest } = quote;
    await updateDoc(doc(fbDb(), "users", uid, "quotations", id), {
      ...rest,
      updatedAt: Date.now(),
    });
    return id;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...quoteData } = quote;
  const ref = await addDoc(collection(fbDb(), "users", uid, "quotations"), {
    ...quoteData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function deleteQuotation(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(fbDb(), "users", uid, "quotations", id));
}

// Sequential quote number per day using a transaction.
export async function nextQuoteNumber(uid: string, prefix = "Q"): Promise<string> {
  const key = todayKey();
  const counterRef = doc(fbDb(), "users", uid, "counters", key);
  const seq = await runTransaction(fbDb(), async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().seq as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { seq: next }, { merge: true });
    return next;
  });
  return `${key}-${prefix}-${String(seq).padStart(5, "0")}`;
}
