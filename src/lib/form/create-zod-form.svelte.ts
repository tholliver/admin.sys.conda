import { z, type ZodObject } from "zod";
import type { TValues, TField } from "./zod-form.type";

type ValidateMode = "onSubmit" | "onChange" | "onBlur";

type FormErrors<TValues> = Partial<Record<Extract<keyof TValues, string>, string>> &
  Record<string, string>;

function mapIssuesToErrors<TValues>(issues: z.ZodIssue[]): FormErrors<TValues> {
  const next: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    if (!next[key]) {
      next[key] = issue.message;
    }
  }
  return next as FormErrors<TValues>;
}

function cloneValues<T>(values: T): T {
  if (values === null || values === undefined) return values;
  if (values instanceof Date) return new Date(values.getTime()) as T;
  if (Array.isArray(values)) return values.map((item) => cloneValues(item)) as T;
  if (typeof values === "object") {
    const plain: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
      plain[key] = cloneValues(value);
    }
    return plain as T;
  }
  return values;
}

interface CreateZodFormOptions<TSchema extends ZodObject<any>> {
  schema: TSchema;
  initialValues: TValues<TSchema>;
  validateMode?: ValidateMode;
}

export class ZodForm<TSchema extends ZodObject<any>> {
  #schema!: TSchema;
  #validateMode!: ValidateMode;
  #initialValues!: TValues<TSchema>;

  values = $state<TValues<TSchema>>({} as TValues<TSchema>);
  errors = $state<FormErrors<TValues<TSchema>>>({});
  touched = $state<Partial<Record<TField<TSchema>, boolean>>>({});
  isSubmitting = $state(false);
  isValid = $derived(Object.keys(this.errors).length === 0);

  constructor({ schema, initialValues, validateMode = "onChange" }: CreateZodFormOptions<TSchema>) {
    this.#schema = schema;
    this.#validateMode = validateMode;
    this.#initialValues = initialValues;
    this.values = cloneValues(initialValues);
  }

  setErrors(nextErrors: FormErrors<TValues<TSchema>>) {
    this.errors = nextErrors;
  }

  setFieldError(field: TField<TSchema>, message: string | undefined) {
    if (!message) {
      const next = { ...this.errors };
      delete next[field];
      this.errors = next;
      return;
    }
    this.errors = { ...this.errors, [field]: message };
  }

  touch(field: TField<TSchema>) {
    this.touched = { ...this.touched, [field]: true };
  }

  setValue(
    field: TField<TSchema>,
    value: TValues<TSchema>[typeof field],
    options: { validate?: boolean; markTouched?: boolean } = {},
  ) {
    this.values = { ...(this.values as Record<string, unknown>), [field]: value } as TValues<TSchema>;

    if (options.markTouched ?? true) {
      this.touch(field);
    }

    const shouldValidate =
      options.validate ?? (this.#validateMode === "onChange" || this.#validateMode === "onBlur");

    if (shouldValidate) {
      this.validateField(field);
    }
  }

  validateAll(): boolean {
    const result = this.#schema.safeParse(this.values);
    if (result.success) {
      this.errors = {};
      return true;
    }
    this.errors = mapIssuesToErrors<TValues<TSchema>>(result.error.issues);
    return false;
  }

  validateField(field: TField<TSchema>): boolean {
    const result = this.#schema.safeParse(this.values);
    if (result.success) {
      this.setFieldError(field, undefined);
      return true;
    }
    const issue = result.error.issues.find((current) => String(current.path[0]) === field);
    this.setFieldError(field, issue?.message);
    return !issue;
  }

  reset(nextValues?: TValues<TSchema>) {
    this.values = cloneValues(nextValues ?? this.#initialValues);
    this.errors = {};
    this.touched = {};
    this.isSubmitting = false;
  }

  onBlur(field: TField<TSchema>) {
    this.touch(field);
    if (this.#validateMode !== "onSubmit") {
      this.validateField(field);
    }
  }

  handleSubmit(handler: (values: TValues<TSchema>) => Promise<void> | void) {
    return async (event?: SubmitEvent) => {
      event?.preventDefault();

      const allTouched: Partial<Record<TField<TSchema>, boolean>> = {};
      for (const key of Object.keys(this.values as object) as TField<TSchema>[]) {
        allTouched[key] = true;
      }
      this.touched = allTouched;

      const isFormValid = this.validateAll();
      if (!isFormValid) return;

      this.isSubmitting = true;
      try {
        await handler(cloneValues(this.values));
      } finally {
        this.isSubmitting = false;
      }
    };
  }
}
