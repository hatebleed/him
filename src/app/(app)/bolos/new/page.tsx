"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { boloUpsertSchema } from "@/lib/validation/records";
import { RecordForm, validateWithSchema, type FormFieldDef } from "@/components/forms/record-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { useStatusOptions } from "@/components/providers/session-provider";

export default function NewBoloPage() {
  const router = useRouter();
  const statusOptions = useStatusOptions("bolo");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fields: FormFieldDef[] = [
    { name: "subject", label: "Subject", required: true, width: "full" },
    { name: "description", label: "Description", type: "textarea", rows: 4 },
    { name: "priority", label: "Priority", type: "select", options: [
      { label: "Medium", value: "MEDIUM" },
      { label: "High", value: "HIGH" },
    ] },
    { name: "status", label: "Status", type: "select", options: statusOptions.map((option) => ({ label: option.label, value: option.key })), required: true },
    { name: "personTarget", label: "Person", type: "record", placeholder: "person" },
    { name: "vehicleTarget", label: "Vehicle", type: "record", placeholder: "vehicle" },
    { name: "expiresAt", label: "Expires at", type: "date" },
    { name: "notes", label: "Notes", type: "textarea", rows: 3 },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; reference: string }>("/api/bolos", {
        ...values,
        personId: values.personTarget || null,
        vehicleId: values.vehicleTarget || null,
      });
      toast.success(`BOLO ${created.reference} created`);
      router.push(`/bolos/${created.id}`);
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
      <PageHeader title="New BOLO" description="BOLOs are visible to everyone who can view them." />
      <Card className="p-4">
        <RecordForm
          fields={fields}
          defaultValues={{ status: statusOptions[0]?.key ?? "ACTIVE", priority: "MEDIUM", subject: "" }}
          schemaResolver={(values) => validateWithSchema(boloUpsertSchema, { ...values, personId: values.personTarget ?? null, vehicleId: values.vehicleTarget ?? null })}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
          submitLabel="Create BOLO"
          onCancel={() => router.push("/bolos")}
        />
      </Card>
    </div>
  );
}
