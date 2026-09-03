"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { warrantUpsertSchema } from "@/lib/validation/records";
import { RecordForm, validateWithSchema, type FormFieldDef } from "@/components/forms/record-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { useStatusOptions } from "@/components/providers/session-provider";

export default function NewWarrantPage() {
  const router = useRouter();
  const statusOptions = useStatusOptions("warrant");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fields: FormFieldDef[] = [
    { name: "personId", label: "Person", type: "record", placeholder: "person", required: true, width: "full" },
    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { label: "Arrest", value: "ARREST" },
        { label: "Search", value: "SEARCH" },
        { label: "Committal", value: "COMMITTAL" },
      ],
    },
    { name: "status", label: "Status", type: "select", options: statusOptions.map((option) => ({ label: option.label, value: option.key })), required: true },
    { name: "issuingAuthority", label: "Issuing authority", width: "full" },
    { name: "issuedAt", label: "Issued at", type: "date" },
    { name: "expiresAt", label: "Expires at", type: "date" },
    { name: "description", label: "Description", type: "textarea", rows: 3 },
    { name: "notes", label: "Notes", type: "textarea", rows: 3 },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; reference: string }>("/api/warrants", values);
      toast.success(`Warrant ${created.reference} created`);
      router.push(`/warrants/${created.id}`);
      router.refresh();
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="New warrant" description="Warrants are linked to a person record." />
      <Card className="p-4">
        <RecordForm
          fields={fields}
          defaultValues={{ status: statusOptions[0]?.key ?? "ACTIVE", type: "ARREST", personId: "" }}
          schemaResolver={(values) => validateWithSchema(warrantUpsertSchema, values)}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
          submitLabel="Create warrant"
          onCancel={() => router.push("/warrants")}
        />
      </Card>
    </div>
  );
}
