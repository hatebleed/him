"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { evidenceUpsertSchema } from "@/lib/validation/records";
import { RecordForm, validateWithSchema, type FormFieldDef } from "@/components/forms/record-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { useCategoryOptions, useStatusOptions } from "@/components/providers/session-provider";

export default function NewEvidencePage() {
  const router = useRouter();
  const statusOptions = useStatusOptions("evidence");
  const categories = useCategoryOptions("evidence");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fields: FormFieldDef[] = [
    { name: "description", label: "Description", required: true, width: "full" },
    { name: "categoryId", label: "Category", type: "select", options: categories.map((option) => ({ label: option.label, value: option.key })) },
    { name: "quantity", label: "Quantity", type: "number" },
    { name: "status", label: "Status", type: "select", options: statusOptions.map((option) => ({ label: option.label, value: option.key })), required: true },
    { name: "location", label: "Storage location" },
    { name: "incidentTarget", label: "Linked incident", type: "record", placeholder: "incident" },
    { name: "collectedAt", label: "Collected at", type: "date" },
    { name: "collectedFrom", label: "Collected from" },
    { name: "notes", label: "Notes", type: "textarea", rows: 3 },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; itemNumber: string }>("/api/evidence", {
        ...values,
        quantity: Number(values.quantity ?? 1),
        incidentId: values.incidentTarget || null,
        categoryId: values.categoryId || null,
      });
      toast.success(`Item ${created.itemNumber} booked in`);
      router.push(`/evidence/${created.id}`);
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
      <PageHeader title="Book in evidence" description="Custody events are recorded automatically and cannot be edited." />
      <Card className="p-4">
        <RecordForm
          fields={fields}
          defaultValues={{ status: statusOptions[0]?.key ?? "IN_CUSTODY", quantity: 1, description: "" }}
          schemaResolver={(values) => validateWithSchema(evidenceUpsertSchema, { ...values, incidentId: values.incidentTarget ?? null, categoryId: values.categoryId ?? null })}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
          submitLabel="Book in item"
          onCancel={() => router.push("/evidence")}
        />
      </Card>
    </div>
  );
}
