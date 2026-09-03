"use client";

import * as React from "react";
import { type FieldValues, type Path, type UseFormReturn, useForm } from "react-hook-form";
import type { ZodTypeAny } from "zod";

import { cn } from "@/lib/utils";
import { Button, Card, FieldError, HelpText, Input, Label, Skeleton, Textarea } from "@/components/ui/primitives";
import { Checkbox, RadioGroup, RadioGroupItem, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@/components/ui/overlays";
import { conditionsMet, type Condition } from "@/lib/rules";
import { RecordPicker, UserPicker, type PickerOption } from "./pickers";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "checkbox"
  | "switch"
  | "radio"
  | "email"
  | "tel"
  | "record"
  | "user"
  | "static"
  | "section";

export type FormFieldDef = {
  name: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ label: string; value: string; colour?: string }>;
  required?: boolean;
  width?: "full" | "half" | "third";
  conditions?: Condition[];
  rows?: number;
  disabled?: boolean;
  /** Display-only value (type: "static"). */
  value?: React.ReactNode;
};

/**
 * The reusable record form.
 *
 * Forms are described as data (field definitions) and rendered here, so a
 * module page never hand-wires inputs. Validation is the same Zod schema the
 * API accepts, and conditional fields are hidden on the client but still
 * enforced on the server.
 */
export function RecordForm<T extends FieldValues>({
  fields,
  onSubmit,
  defaultValues,
  schemaResolver,
  submitting,
  submitLabel = "Save",
  cancelHref,
  onCancel,
  error,
  children,
  className,
  compact,
}: {
  fields: FormFieldDef[];
  onSubmit: (values: T) => Promise<void> | void;
  defaultValues?: Partial<T>;
  schemaResolver?: (values: T) => Record<string, string> | null;
  submitting?: boolean;
  submitLabel?: string;
  cancelHref?: string;
  onCancel?: () => void;
  error?: string | null;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const form = useForm<T>({ defaultValues: defaultValues as never, mode: "onBlur" });
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});
  const values = form.watch() as Record<string, unknown>;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setClientErrors({});
    const current = form.getValues() as T;
    const issues = schemaResolver?.(current) ?? null;
    if (issues) {
      setClientErrors(issues);
      return;
    }
    await onSubmit(current);
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-5", className)} noValidate>
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      <div className={cn("grid gap-4", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {fields.map((field) => {
          if (!conditionsMet(field.conditions, values)) return null;
          if (field.type === "section") {
            return (
              <div key={field.name} className="col-span-full pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{field.label}</p>
                {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
              </div>
            );
          }
          return (
            <FieldControl
              key={field.name}
              field={field}
              form={form}
              values={values}
              error={clientErrors[field.name]}
            />
          );
        })}
      </div>

      {children}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
        {onCancel || cancelHref ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (onCancel) onCancel();
              else if (cancelHref) window.location.href = cancelHref;
            }}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function FieldControl<T extends FieldValues>({
  field,
  form,
  values,
  error,
}: {
  field: FormFieldDef;
  form: UseFormReturn<T>;
  values: Record<string, unknown>;
  error?: string;
}) {
  const name = field.name as Path<T>;
  const register = form.register(name);
  const width =
    field.width === "full" || field.type === "textarea" || field.type === "static"
      ? "sm:col-span-2 lg:col-span-3"
      : field.width === "half"
        ? "sm:col-span-2"
        : "";

  const wrapper = (children: React.ReactNode) => (
    <div className={cn("space-y-1.5", width)}>
      {field.type === "checkbox" || field.type === "switch" ? null : (
        <Label htmlFor={field.name}>
          {field.label}
          {field.required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </Label>
      )}
      {children}
      {error ? <FieldError>{error}</FieldError> : <HelpText>{field.helpText}</HelpText>}
    </div>
  );

  switch (field.type) {
    case "textarea":
      return wrapper(
        <Textarea id={field.name} rows={field.rows ?? 4} placeholder={field.placeholder} disabled={field.disabled} {...register} />,
      );

    case "number":
      return wrapper(<Input id={field.name} type="number" placeholder={field.placeholder} disabled={field.disabled} {...register} />);

    case "date":
      return wrapper(<Input id={field.name} type="date" disabled={field.disabled} {...register} />);

    case "email":
      return wrapper(<Input id={field.name} type="email" placeholder={field.placeholder} disabled={field.disabled} {...register} />);

    case "tel":
      return wrapper(<Input id={field.name} type="tel" placeholder={field.placeholder} disabled={field.disabled} {...register} />);

    case "select": {
      const current = String(values[field.name] ?? "");
      return wrapper(
        <Select
          value={current}
          onValueChange={(value) => form.setValue(name, value as never, { shouldDirty: true })}
          disabled={field.disabled}
        >
          <SelectTrigger id={field.name} aria-label={field.label}>
            <SelectValue placeholder={field.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      );
    }

    case "multiselect": {
      const selected = Array.isArray(values[field.name]) ? (values[field.name] as string[]) : [];
      return wrapper(
        <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background/60 p-2">
          {(field.options ?? []).map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  form.setValue(
                    name,
                    (active ? selected.filter((value) => value !== option.value) : [...selected, option.value]) as never,
                    { shouldDirty: true },
                  )
                }
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs transition-colors",
                  active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>,
      );
    }

    case "radio":
      return wrapper(
        <RadioGroup value={String(values[field.name] ?? "")} onValueChange={(value) => form.setValue(name, value as never)} className="gap-1.5">
          {(field.options ?? []).map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem value={option.value} id={`${field.name}-${option.value}`} />
              <label htmlFor={`${field.name}-${option.value}`} className="text-sm">
                {option.label}
              </label>
            </div>
          ))}
        </RadioGroup>,
      );

    case "checkbox":
      return (
        <div className={cn("flex items-center gap-2", width)}>
          <Checkbox
            id={field.name}
            checked={Boolean(values[field.name])}
            onCheckedChange={(checked: boolean) => form.setValue(name, checked as never, { shouldDirty: true })}
            disabled={field.disabled}
          />
          <label htmlFor={field.name} className="text-sm">
            {field.label}
          </label>
        </div>
      );

    case "switch":
      return (
        <div className={cn("flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2", width)}>
          <div>
            <p className="text-sm">{field.label}</p>
            {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
          </div>
          <Switch
            checked={Boolean(values[field.name])}
            onCheckedChange={(checked: boolean) => form.setValue(name, checked as never, { shouldDirty: true })}
            disabled={field.disabled}
          />
        </div>
      );

    case "record": {
      const option: PickerOption | null = values[`${field.name}Label`] ? { id: String(values[field.name] ?? ""), label: String(values[`${field.name}Label`]) } : null;
      return wrapper(
        <RecordPicker
          resource={field.placeholder ?? "person"}
          value={String(values[field.name] ?? "") || null}
          selected={option}
          onChange={(next) => {
            form.setValue(name, (next?.id ?? "") as never, { shouldDirty: true });
            form.setValue(`${field.name}Label` as Path<T>, (next?.label ?? "") as never);
          }}
          placeholder={`Search ${field.placeholder ?? "records"}…`}
          disabled={field.disabled}
        />,
      );
    }

    case "user":
      return wrapper(
        <UserPicker
          value={String(values[field.name] ?? "") || null}
          onChange={(userId) => form.setValue(name, (userId ?? "") as never, { shouldDirty: true })}
          disabled={field.disabled}
        />,
      );

    case "static":
      return (
        <div className={cn("space-y-1.5", width)}>
          <Label>{field.label}</Label>
          <div className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-sm">{field.value ?? "—"}</div>
        </div>
      );

    default:
      return wrapper(<Input id={field.name} placeholder={field.placeholder} disabled={field.disabled} {...register} />);
  }
}

/** Lightweight validation helper for forms that do not use a Zod resolver. */
export function validateWithSchema<T>(schema: ZodTypeAny, values: T): Record<string, string> | null {
  const result = schema.safeParse(values);
  if (result.success) return null;
  const issues: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!issues[path]) issues[path] = issue.message;
  }
  return issues;
}

export { Card, Skeleton };
