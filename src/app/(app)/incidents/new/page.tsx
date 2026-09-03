"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { incidentUpsertSchema } from "@/lib/validation/operations";
import { RecordForm, validateWithSchema, type FormFieldDef } from "@/components/forms/record-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { useSession, useCategoryOptions, useStatusOptions } from "@/components/providers/session-provider";

export default function NewIncidentPage() {
  const router = useRouter();
  const { term } = useSession();
  const statusOptions = useStatusOptions("incident");
  const categoryOptions = useCategoryOptions("incident");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fields: FormFieldDef[] = [
    { name: "title", label: "Title", required: true, width: "full", placeholder: "Short description of what happened" },
    { name: "description", label: "Description", type: "textarea", rows: 5, helpText: "Record what is known at the time of creation." },
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
        { label: "Critical", value: "CRITICAL" },
      ],
      helpText: "High priority incidents trigger the escalation workflow.",
    },
    { name: "categoryId", label: "Category", type: "select", options: categoryOptions.map((option) => ({ label: option.label, value: option.key })) },
    { name: "location", label: "Location", width: "full" },
    { name: "occurredAt", label: "Occurred at", type: "date" },
    { name: "reportedAt", label: "Reported at", type: "date" },
    { name: "supervisorIdentification", label: "Supervisor", type: "user" },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; reference: string }>("/api/incidents", {
        ...values,
        supervisorId: values.supervisorIdentification || null,
        categoryId: values.categoryId || null,
      });
      toast.success(`${term("incident", "singular", "Incident")} ${created.reference} created`);
      router.push(`/incidents/${created.id}`);
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
      <PageHeader title={`New ${term("incident", "singular", "incident")}`} description="People, vehicles and units can be linked once the incident exists." />
      <Card className="p-4">
        <RecordForm
          fields={fields}
          defaultValues={{ status: statusOptions[0]?.key ?? "NEW", priority: "MEDIUM", title: "" }}
          schemaResolver={(values) => validateWithSchema(incidentUpsertSchema, values)}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
          submitLabel="Create incident"
          onCancel={() => router.push("/incidents")}
        />
      </Card>
    </div>
  );
}
