"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { personUpsertSchema } from "@/lib/validation/people";
import { RecordForm, validateWithSchema, type FormFieldDef } from "@/components/forms/record-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";

/** Create a person record with identifiers, contacts and addresses. */
export default function NewPersonPage() {
  const router = useRouter();
  const { term, data } = useSession();
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const statusOptions = (data?.config?.statuses?.person ?? []).map((option) => ({ label: option.label, value: option.key }));
  const fields: FormFieldDef[] = [
    { name: "section.identity", label: "Identity", type: "section" },
    { name: "firstName", label: "First name", required: true, placeholder: "Given name" },
    { name: "lastName", label: "Last name", required: true, placeholder: "Family name" },
    { name: "middleName", label: "Middle name" },
    { name: "alias", label: "Alias / known as" },
    { name: "dateOfBirth", label: "Date of birth", type: "date" },
    { name: "gender", label: "Gender" },
    { name: "nationality", label: "Nationality" },
    { name: "occupation", label: "Occupation" },
    { name: "section.record", label: "Record", type: "section" },
    { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    { name: "riskLevel", label: "Risk level", type: "select", options: [
      { label: "Low", value: "LOW" },
      { label: "Medium", value: "MEDIUM" },
      { label: "High", value: "HIGH" },
    ] },
    { name: "notes", label: "Notes", type: "textarea", rows: 3, helpText: "Internal notes are visible to users who can view this record." },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; reference: string }>("/api/people", {
        ...values,
        departmentId: null,
        categoryId: null,
        identifiers: [],
        contacts: [],
        addresses: [],
      });
      toast.success(`${term("person", "singular", "Person")} ${created.reference} created`);
      router.push(`/people/${created.id}`);
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
      <PageHeader
        title={`New ${term("person", "singular", "person")}`}
        description="Contacts, identifiers and addresses can be added once the record exists."
      />
      <Card className="p-4">
        <RecordForm
          fields={fields}
          defaultValues={{ status: statusOptions[0]?.value ?? "ACTIVE", firstName: "", lastName: "" }}
          schemaResolver={(values) => validateWithSchema(personUpsertSchema, values)}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
          submitLabel="Create record"
          onCancel={() => router.push("/people")}
        />
      </Card>
    </div>
  );
}
