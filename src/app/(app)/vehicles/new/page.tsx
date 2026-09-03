"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { vehicleUpsertSchema } from "@/lib/validation/people";
import { RecordForm, validateWithSchema, type FormFieldDef } from "@/components/forms/record-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { useSession, useStatusOptions } from "@/components/providers/session-provider";

export default function NewVehiclePage() {
  const router = useRouter();
  const { term } = useSession();
  const statusOptions = useStatusOptions("vehicle");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fields: FormFieldDef[] = [
    { name: "registration", label: "Registration", required: true, placeholder: "NG12 ABC" },
    { name: "make", label: "Make" },
    { name: "model", label: "Model" },
    { name: "year", label: "Year", type: "number" },
    { name: "colour", label: "Colour" },
    { name: "bodyType", label: "Body type" },
    { name: "fuelType", label: "Fuel type" },
    { name: "vin", label: "VIN / chassis" },
    { name: "status", label: "Status", type: "select", options: statusOptions.map((option) => ({ label: option.label, value: option.key })), required: true },
    { name: "notes", label: "Notes", type: "textarea", rows: 3 },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; registration: string }>("/api/vehicles", values);
      toast.success(`${term("vehicle", "singular", "Vehicle")} ${created.registration} created`);
      router.push(`/vehicles/${created.id}`);
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
      <PageHeader title={`New ${term("vehicle", "singular", "vehicle")}`} description="Link an owner once the record exists." />
      <Card className="p-4">
        <RecordForm
          fields={fields}
          defaultValues={{ status: statusOptions[0]?.key ?? "ACTIVE", registration: "" }}
          schemaResolver={(values) => validateWithSchema(vehicleUpsertSchema, values)}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
          submitLabel="Create record"
          onCancel={() => router.push("/vehicles")}
        />
      </Card>
    </div>
  );
}
