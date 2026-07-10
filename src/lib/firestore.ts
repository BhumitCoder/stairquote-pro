import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { fbDb } from "./firebase";
import type { AppSettings, Client, Invoice, Quotation } from "./types";
import { DEFAULT_SETTINGS } from "./settings-defaults";

function userRoot(uid: string) {
  return doc(fbDb(), "users", uid);
}

// Firestore rejects `undefined` field values outright, so writes must never contain them.
function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => pruneUndefined(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = pruneUndefined(v);
    }
    return out as T;
  }
  return value;
}

// For updates, an `undefined` top-level field means "remove it" (e.g. clearing a callback date).
function toUpdatePayload(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v === undefined ? deleteField() : pruneUndefined(v);
  }
  return out;
}

// ============ Settings ============
export async function getSettings(uid: string): Promise<AppSettings> {
  const snap = await getDoc(doc(fbDb(), "users", uid, "meta", "settings"));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  const data = snap.data() as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    company: { ...DEFAULT_SETTINGS.company, ...data.company },
    bank: { ...DEFAULT_SETTINGS.bank, ...data.bank },
    dropdowns: { ...DEFAULT_SETTINGS.dropdowns, ...data.dropdowns },
  };
}

export async function saveSettings(uid: string, s: AppSettings): Promise<void> {
  await setDoc(doc(fbDb(), "users", uid, "meta", "settings"), pruneUndefined(s));
  // ensure user root exists
  await setDoc(userRoot(uid), { updatedAt: serverTimestamp() }, { merge: true });
}

// ============ Clients ============
export async function listClients(uid: string): Promise<Client[]> {
  const q = query(collection(fbDb(), "users", uid, "clients"), orderBy("name"));
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
    await updateDoc(doc(fbDb(), "users", uid, "clients", id), toUpdatePayload(rest));
    return id;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...clientData } = client;
  const ref = await addDoc(collection(fbDb(), "users", uid, "clients"), {
    ...pruneUndefined(clientData),
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteClient(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(fbDb(), "users", uid, "clients", id));
}

// ============ Quotations ============
export async function listQuotations(uid: string): Promise<Quotation[]> {
  const q = query(collection(fbDb(), "users", uid, "quotations"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Quotation, "id">) }));
}

export async function listQuotationsByClient(uid: string, clientId: string): Promise<Quotation[]> {
  // No orderBy here: where(==) + orderBy(other field) needs a composite index in
  // Firestore and fails outright without one. Sort in memory instead.
  const q = query(
    collection(fbDb(), "users", uid, "quotations"),
    where("clientId", "==", clientId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Quotation, "id">) }))
    .sort((a, b) => b.date - a.date);
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
      ...toUpdatePayload(rest),
      updatedAt: Date.now(),
    });
    return id;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...quoteData } = quote;
  const ref = await addDoc(collection(fbDb(), "users", uid, "quotations"), {
    ...pruneUndefined(quoteData),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function deleteQuotation(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(fbDb(), "users", uid, "quotations", id));
}

// ============ Bills / Invoices ============
export async function listInvoices(uid: string): Promise<Invoice[]> {
  const q = query(collection(fbDb(), "users", uid, "invoices"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invoice, "id">) }));
}

export async function listInvoicesByClient(uid: string, clientId: string): Promise<Invoice[]> {
  // No orderBy: where(==) + orderBy(other field) would need a composite index.
  const q = query(collection(fbDb(), "users", uid, "invoices"), where("clientId", "==", clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Invoice, "id">) }))
    .sort((a, b) => b.date - a.date);
}

export async function getInvoice(uid: string, id: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(fbDb(), "users", uid, "invoices", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Invoice, "id">) };
}

export async function saveInvoice(
  uid: string,
  invoice: Omit<Invoice, "id"> & { id?: string },
): Promise<string> {
  if (invoice.id) {
    const { id, ...rest } = invoice;
    await updateDoc(doc(fbDb(), "users", uid, "invoices", id), {
      ...toUpdatePayload(rest),
      updatedAt: Date.now(),
    });
    return id;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...invoiceData } = invoice;
  const ref = await addDoc(collection(fbDb(), "users", uid, "invoices"), {
    ...pruneUndefined(invoiceData),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function deleteInvoice(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(fbDb(), "users", uid, "invoices", id));
}

// Global running bill number (INV-00001, …) using a transaction.
export async function nextInvoiceNumber(uid: string, prefix = "INV"): Promise<string> {
  const counterRef = doc(fbDb(), "users", uid, "counters", "invoices");
  let seed = 0;
  const existing = await getDoc(counterRef);
  if (!existing.exists()) {
    const snap = await getDocs(collection(fbDb(), "users", uid, "invoices"));
    seed = snap.size;
  }
  const seq = await runTransaction(fbDb(), async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().seq as number) : seed;
    const next = current + 1;
    tx.set(counterRef, { seq: next }, { merge: true });
    return next;
  });
  return `${prefix}-${String(seq).padStart(5, "0")}`;
}

// Global running quote number (Q-00001, Q-00002, …) using a transaction.
export async function nextQuoteNumber(uid: string, prefix = "Q"): Promise<string> {
  const counterRef = doc(fbDb(), "users", uid, "counters", "quotations");

  // First use: seed the counter from the existing quote count so numbering
  // continues instead of restarting at 1.
  let seed = 0;
  const existing = await getDoc(counterRef);
  if (!existing.exists()) {
    const snap = await getDocs(collection(fbDb(), "users", uid, "quotations"));
    seed = snap.size;
  }

  const seq = await runTransaction(fbDb(), async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().seq as number) : seed;
    const next = current + 1;
    tx.set(counterRef, { seq: next }, { merge: true });
    return next;
  });
  return `${prefix}-${String(seq).padStart(5, "0")}`;
}
