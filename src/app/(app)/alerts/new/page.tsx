"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { alertUpsertSchema } from "@/lib/validation/records";
import { RecordForm, validateWithSchema, type FormFieldDef } from "@/components/forms/record-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { useCategoryOptions, useStatusOptions } from "@/components/providers/session-provider";

export default function NewAlertPage() {
  const router = useRouter();
  const statusOptions = useStatusOptions("alert");
  const categories = useCategoryOptions("alert");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fields: FormFieldDef[] = [
    { name: "subject", label: "Subject", required: true, width: "full" },
    { name: "description", label: "Description", type: "textarea", rows: 4 },
    { name: "type", label: "Type", type: "select", options: [
      { label: "Safety", value: "SAFETY" },
      { label: "Operational", value: "OPERATIONAL" },
      { label: "Information", value: "INFORMATION" },
    ] },
    { name: "priority", label: "Priority", type: "select", options: [
      { label: "Low", value: "LOW" },
      { label: "Medium", value: "MEDIUM" },
      { label: "High", value: "HIGH" },
      { label: "Critical", value: "CRITICAL" },
    ] },
    { name: "status", label: "Status", type: "select", options: statusOptions.map((option) => ({ label: option.label, value: option.key })), required: true },
    { name: "categoryId", label: "Category", type: "select", options: categories.map((option) => ({ label: option.label, value: option.key })) },
    { name: "expiresAt", label: "Expires at", type: "date" },
    { name: "personTarget", label: "Linked person", type: "record", placeholder: "person" },
    { name: "vehicleTarget", label: "Linked vehicle", type: "record", placeholder: "vehicle" },
    { name: "notify", label: "Notify everyone who can view alerts", type: "switch", helpText: "Sends an in-app notification immediately." },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; reference: string }>("/api/alerts", {
        ...values,
        personId: values.personTarget || null,
        vehicleId: values.vehicleTarget || null,
        categoryId: values.categoryId || null,
      });
      toast.success(`Alert ${created.reference} created`);
      router.push(`/alerts/${created.id}`);
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
      <PageHeader title="New alert" description="Alerts appear on dashboards and in the notification centre." />
      <Card className="p-4">
        <RecordForm
          fields={fields}
          defaultValues={{ status: statusOptions[0]?.key ?? "ACTIVE", type: "OPERATIONAL", priority: "MEDIUM", subject: "", notify: false }}
          schemaResolver={(values) => validateWithSchema(alertUpsertSchema, { ...values, personId: values.personTarget ?? null, vehicleId: values.vehicleTarget ?? null, categoryId: values.categoryId ?? null })}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
          submitLabel="Create alert"
          onCancel={() => router.push("/alerts")}
        />
      </Card>
    </div>
  );
}
