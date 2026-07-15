import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getSettings, saveSettings } from "@/lib/firestore";
import { uploadFile, deleteFile } from "@/lib/storage";
import type { AppSettings, RateMode } from "@/lib/types";
import { DEFAULT_SETTINGS, RATE_BASIS_ALL, RATE_BASIS_LABELS } from "@/lib/settings-defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Trash2,
  Plus,
  Building2,
  FileText,
  Landmark,
  ListChecks,
  SlidersHorizontal,
  Save,
  Stamp,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS);

  const { data } = useQuery({
    queryKey: ["settings", user?.uid],
    queryFn: () => getSettings(user!.uid),
    enabled: !!user,
  });

  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => saveSettings(user!.uid, s),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings", user?.uid] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [stampBusy, setStampBusy] = useState(false);

  async function handleStampUpload(file: File) {
    setStampBusy(true);
    try {
      const oldPath = s.company.stampPath;
      const path = `users/${user!.uid}/stamp/${Date.now()}-${file.name}`;
      const { url } = await uploadFile(path, file);
      setS({ ...s, company: { ...s.company, stampUrl: url, stampPath: path } });
      if (oldPath) void deleteFile(oldPath);
      toast.success("Stamp uploaded — remember to Save Changes");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStampBusy(false);
    }
  }

  const updateList = (key: "stairTypes" | "materials" | "units", list: string[]) =>
    setS({ ...s, dropdowns: { ...s.dropdowns, [key]: list } });

  const rateBasisList = s.dropdowns.rateBasis?.length ? s.dropdowns.rateBasis : RATE_BASIS_ALL;
  const updateRateBasis = (list: RateMode[]) =>
    setS({ ...s, dropdowns: { ...s.dropdowns, rateBasis: list } });

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your company profile, PDF content, and quotation defaults
          </p>
        </div>
      </div>

      <Tabs defaultValue="company" className="max-w-6xl">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Company
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-1.5">
            <Landmark className="h-3.5 w-3.5" /> Bank
          </TabsTrigger>
          <TabsTrigger value="terms" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Terms
          </TabsTrigger>
          <TabsTrigger value="dropdowns" className="gap-1.5">
            <ListChecks className="h-3.5 w-3.5" /> Dropdowns
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" /> General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Company Profile
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Shown on every quotation PDF header and used across the app.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Business Name">
                <Input
                  value={s.company.name}
                  onChange={(e) => setS({ ...s, company: { ...s.company, name: e.target.value } })}
                />
              </Field>
              <Field label="GST Number">
                <Input
                  value={s.company.gst}
                  onChange={(e) => setS({ ...s, company: { ...s.company, gst: e.target.value } })}
                />
              </Field>
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Address (each comma starts a new line on the PDF)">
                  <Textarea
                    rows={3}
                    value={s.company.address}
                    onChange={(e) =>
                      setS({ ...s, company: { ...s.company, address: e.target.value } })
                    }
                  />
                </Field>
              </div>
              <Field label="Phone Numbers">
                <Input
                  value={s.company.phones}
                  onChange={(e) =>
                    setS({ ...s, company: { ...s.company, phones: e.target.value } })
                  }
                />
              </Field>
              <Field label="Email">
                <Input
                  value={s.company.email}
                  onChange={(e) => setS({ ...s, company: { ...s.company, email: e.target.value } })}
                />
              </Field>
              <Field label="Website">
                <Input
                  value={s.company.website}
                  onChange={(e) =>
                    setS({ ...s, company: { ...s.company, website: e.target.value } })
                  }
                />
              </Field>
              <Field label="Sales Person">
                <Input
                  value={s.company.salesPerson}
                  onChange={(e) =>
                    setS({ ...s, company: { ...s.company, salesPerson: e.target.value } })
                  }
                />
              </Field>

              <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4 sm:col-span-2 lg:col-span-3">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background">
                  {s.company.stampUrl ? (
                    <img
                      src={s.company.stampUrl}
                      alt="Company stamp"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Stamp className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Company Stamp / Seal</div>
                  <p className="text-xs text-muted-foreground">
                    Printed in the signature area of every quotation and bill, above "Authorized
                    Signatory". Use a PNG with transparent background for best results.
                  </p>
                  <div className="flex gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={stampBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleStampUpload(f);
                          e.target.value = "";
                        }}
                      />
                      <Button asChild variant="outline" size="sm" className="mt-1">
                        <span>{stampBusy ? "Uploading…" : "Upload Stamp"}</span>
                      </Button>
                    </label>
                    {s.company.stampUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 text-destructive hover:text-destructive"
                        disabled={stampBusy}
                        onClick={() => {
                          if (s.company.stampPath) void deleteFile(s.company.stampPath);
                          setS({
                            ...s,
                            company: { ...s.company, stampUrl: undefined, stampPath: undefined },
                          });
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" /> Terms &amp; Conditions
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Numbered list printed at the bottom of every quotation.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {s.termsAndConditions.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="mt-2.5 text-sm text-muted-foreground">{i + 1}.</span>
                    <Textarea
                      rows={2}
                      value={t}
                      onChange={(e) => {
                        const arr = [...s.termsAndConditions];
                        arr[i] = e.target.value;
                        setS({ ...s, termsAndConditions: arr });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setS({
                          ...s,
                          termsAndConditions: s.termsAndConditions.filter((_, x) => x !== i),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setS({ ...s, termsAndConditions: [...s.termsAndConditions, ""] })}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Condition
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Loading / Transport Notice</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Highlighted red notice above payment terms on the PDF.
                </p>
              </CardHeader>
              <CardContent>
                <Input
                  value={s.loadingNotice}
                  onChange={(e) => setS({ ...s, loadingNotice: e.target.value })}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dropdowns" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <DropdownEditor
              title="Stair Types"
              items={s.dropdowns.stairTypes}
              onChange={(l) => updateList("stairTypes", l)}
            />
            <DropdownEditor
              title="Materials"
              items={s.dropdowns.materials}
              onChange={(l) => updateList("materials", l)}
            />
            <DropdownEditor
              title="Measurement Units"
              items={s.dropdowns.units}
              onChange={(l) => updateList("units", l)}
            />
            <RateBasisEditor list={rateBasisList} onChange={updateRateBasis} />
          </div>
        </TabsContent>

        <TabsContent value="bank" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" /> Bank / Payment Details
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Printed on bills (tax invoices) only — never on quotations. Leave blank to hide.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Account Name">
                <Input
                  value={s.bank.accountName}
                  onChange={(e) => setS({ ...s, bank: { ...s.bank, accountName: e.target.value } })}
                />
              </Field>
              <Field label="Bank Name">
                <Input
                  value={s.bank.bankName}
                  onChange={(e) => setS({ ...s, bank: { ...s.bank, bankName: e.target.value } })}
                />
              </Field>
              <Field label="Branch">
                <Input
                  value={s.bank.branch}
                  onChange={(e) => setS({ ...s, bank: { ...s.bank, branch: e.target.value } })}
                />
              </Field>
              <Field label="Account No.">
                <Input
                  value={s.bank.accountNo}
                  onChange={(e) => setS({ ...s, bank: { ...s.bank, accountNo: e.target.value } })}
                />
              </Field>
              <Field label="IFSC Code">
                <Input
                  value={s.bank.ifsc}
                  onChange={(e) => setS({ ...s, bank: { ...s.bank, ifsc: e.target.value } })}
                />
              </Field>
              <Field label="UPI ID">
                <Input
                  placeholder="e.g. vastu@upi"
                  value={s.bank.upiId}
                  onChange={(e) => setS({ ...s, bank: { ...s.bank, upiId: e.target.value } })}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" /> General
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Defaults applied to every new quotation.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="GST %">
                <Input
                  type="number"
                  value={s.gstPercent}
                  onChange={(e) => setS({ ...s, gstPercent: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Currency Symbol">
                <Input
                  value={s.currency}
                  onChange={(e) => setS({ ...s, currency: e.target.value })}
                />
              </Field>
              <Field label="Quote Number Prefix">
                <Input
                  value={s.quotePrefix}
                  onChange={(e) => setS({ ...s, quotePrefix: e.target.value })}
                />
              </Field>
              <Field label="Bill Number Prefix">
                <Input
                  value={s.invoicePrefix}
                  onChange={(e) => setS({ ...s, invoicePrefix: e.target.value })}
                />
              </Field>
              <Field label="Document Title">
                <select
                  className="h-10 rounded-md border bg-background px-3"
                  value={s.docTitle}
                  onChange={(e) =>
                    setS({ ...s, docTitle: e.target.value as "Estimate" | "Quotation" })
                  }
                >
                  <option>Estimate</option>
                  <option>Quotation</option>
                </select>
              </Field>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur md:left-[var(--sidebar-w)] md:px-8">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {saveMut.isSuccess ? "All changes saved" : "Remember to save your changes"}
          </span>
          <Button
            size="lg"
            className="h-11 gap-2"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            <Save className="h-4 w-4" />
            {saveMut.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DropdownEditor({
  title,
  items,
  onChange,
}: {
  title: string;
  items: string[];
  onChange: (l: string[]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={v}
              onChange={(e) => {
                const arr = [...items];
                arr[i] = e.target.value;
                onChange(arr);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange(items.filter((_, x) => x !== i))}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </CardContent>
    </Card>
  );
}

function RateBasisEditor({
  list,
  onChange,
}: {
  list: RateMode[];
  onChange: (l: RateMode[]) => void;
}) {
  const enabled = list.filter((m) => RATE_BASIS_ALL.includes(m));
  const disabled = RATE_BASIS_ALL.filter((m) => !enabled.includes(m));

  function move(i: number, dir: -1 | 1) {
    const arr = [...enabled];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rate Basis</CardTitle>
        <p className="text-xs text-muted-foreground">
          Options shown in the item "Rate Basis" dropdown (Quotations &amp; Bills), in this order.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {enabled.map((mode, i) => (
          <div key={mode} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
            <span className="flex-1 text-sm">{RATE_BASIS_LABELS[mode]}</span>
            <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => move(i, 1)}
              disabled={i === enabled.length - 1}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange(enabled.filter((m) => m !== mode))}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {disabled.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {disabled.map((mode) => (
              <Button
                key={mode}
                variant="outline"
                size="sm"
                onClick={() => onChange([...enabled, mode])}
              >
                <Plus className="mr-1 h-4 w-4" /> {RATE_BASIS_LABELS[mode]}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
