"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { caseUpsertSchema } from "@/lib/validation/operations";
import { RecordForm, validateWithSchema, type FormFieldDef } from "@/components/forms/record-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";

export default function NewCasePage() {
  const router = useRouter();
  const { term } = useSession();
  const statusOptions = useStatusOptions("case");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fields: FormFieldDef[] = [
    { name: "title", label: "Case title", required: true, width: "full" },
    { name: "description", label: "Description", type: "textarea", rows: 5 },
    { name: "status", label: "Status", type: "select", options: statusOptions.map((option) => ({ label: option.label, value: option.key })), required: true },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      required: true,
      options: [
        { label: "Low", value: "LOW" },
        { label: "Medium", value: "MEDIUM" },
        { label: "High", value: "HIGH" },
      ],
    },
    { name: "leadSelection", label: "Case lead", type: "user" },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; reference: string }>("/api/cases", {
        title: values.title,
        description: values.description ?? null,
        status: values.status,
        priority: values.priority,
        leadId: values.leadSelection || null,
        incidentIds: [],
      });
      toast.success(`${term("case", "singular", "Case")} ${created.reference} created`);
      router.push(`/cases/${created.id}`);
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
      <PageHeader title={`New ${term("case", "singular", "case")}`} description="Link incidents to the case once it exists." />
      <Card className="p-4">
        <RecordForm
          fields={fields}
          defaultValues={{ status: statusOptions[0]?.key ?? "OPEN", priority: "MEDIUM", title: "", description: "" }}
          schemaResolver={(values) => validateWithSchema(caseUpsertSchema, { ...values, leadId: values.leadSelection ?? null, incidentIds: [] })}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
          submitLabel="Create case"
          onCancel={() => router.push("/cases")}
        />
      </Card>
    </div>
  );
}
