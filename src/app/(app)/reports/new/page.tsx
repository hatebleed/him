"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { reportUpsertSchema } from "@/lib/validation/records";
import { RecordForm, validateWithSchema, type FormFieldDef } from "@/components/forms/record-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { useSession, useCategoryOptions } from "@/components/providers/session-provider";

export default function NewReportPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { term } = useSession();
  const categories = useCategoryOptions("report");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const incidentId = params.get("incidentId");
  const caseId = params.get("caseId");

  const fields: FormFieldDef[] = [
    { name: "title", label: "Title", required: true, width: "full" },
    { name: "categoryId", label: "Category", type: "select", options: categories.map((option) => ({ label: option.label, value: option.key })) },
    { name: "incidentTarget", label: "Linked incident", type: "record", placeholder: "incident" },
    { name: "body", label: "Report body", type: "textarea", rows: 14, helpText: "Type the narrative. Each save creates a new immutable version." },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; reference: string }>("/api/reports", {
        title: values.title,
        body: values.body ?? "",
        status: "DRAFT",
        categoryId: (values.categoryId as string) || null,
        incidentId: (values.incidentTarget as string) || incidentId || null,
        caseId: caseId || null,
      });
      toast.success(`${term("report", "singular", "Report")} ${created.reference} created`);
      router.push(`/reports/${created.id}`);
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
      <PageHeader title={`New ${term("report", "singular", "report")}`} description="Reports start as drafts and move through review and approval." />
      <Card className="p-4">
        <RecordForm
          fields={fields}
          defaultValues={{ title: "", body: "", incidentTarget: incidentId ?? "", categoryId: "" }}
          schemaResolver={(values) => validateWithSchema(reportUpsertSchema, { ...values, incidentId: values.incidentTarget ?? null, formData: null })}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
          submitLabel="Create draft"
          onCancel={() => router.push("/reports")}
        />
      </Card>
    </div>
  );
}
