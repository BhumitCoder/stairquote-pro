import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getSettings, saveSettings } from "@/lib/firestore";
import type { AppSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
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
  ListChecks,
  SlidersHorizontal,
  Save,
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

  const updateList = (key: "stairTypes" | "materials" | "units", list: string[]) =>
    setS({ ...s, dropdowns: { ...s.dropdowns, [key]: list } });

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

      <Tabs defaultValue="company" className="max-w-4xl">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Company
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
            <CardContent className="grid gap-3 sm:grid-cols-2">
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
              <div className="sm:col-span-2">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Payment Terms
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Appears above Terms &amp; Conditions on the PDF.
                </p>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={5}
                  value={s.paymentTerms}
                  onChange={(e) => setS({ ...s, paymentTerms: e.target.value })}
                />
              </CardContent>
            </Card>
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
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
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
            <CardContent className="grid gap-3 sm:grid-cols-2">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
