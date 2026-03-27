import { z, type ZodObject } from "zod";

export type TValues<TSchema extends ZodObject<any>> = z.input<TSchema>;
export type TField<TSchema extends ZodObject<any>> = Extract<keyof z.input<TSchema>, string>;
