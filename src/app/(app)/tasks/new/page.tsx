"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { taskUpsertSchema } from "@/lib/validation/records";
import { RecordForm, validateWithSchema, type FormFieldDef } from "@/components/forms/record-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { useStatusOptions } from "@/components/providers/session-provider";

export default function NewTaskPage() {
  const router = useRouter();
  const params = useSearchParams();
  const statusOptions = useStatusOptions("task");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fields: FormFieldDef[] = [
    { name: "title", label: "Title", required: true, width: "full" },
    { name: "description", label: "Description", type: "textarea", rows: 4 },
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
    { name: "assigneeSelection", label: "Assignee", type: "user" },
    { name: "dueAt", label: "Due date", type: "date" },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string; reference: string }>("/api/tasks", {
        title: values.title,
        description: values.description ?? null,
        status: values.status,
        priority: values.priority,
        assigneeId: values.assigneeSelection || null,
        dueAt: values.dueAt || null,
        recordType: params.get("recordType"),
        recordId: params.get("recordId"),
      });
      toast.success(`Task ${created.reference} created`);
      router.push(`/tasks/${created.id}`);
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
      <PageHeader title="New task" description="Tasks can be linked to any record and tracked to completion." />
      <Card className="p-4">
        <RecordForm
          fields={fields}
          defaultValues={{ status: statusOptions[0]?.key ?? "OPEN", priority: "MEDIUM", title: "", description: "" }}
          schemaResolver={(values) => validateWithSchema(taskUpsertSchema, { ...values, assigneeId: values.assigneeSelection ?? null, recordType: params.get("recordType"), recordId: params.get("recordId") })}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
          submitLabel="Create task"
          onCancel={() => router.push("/tasks")}
        />
      </Card>
    </div>
  );
}
