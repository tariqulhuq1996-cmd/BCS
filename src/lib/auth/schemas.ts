import * as z from "zod";

const email = z.email({ error: "সঠিক ইমেইল ঠিকানা লিখুন।" }).trim().toLowerCase();
const password = z
  .string()
  .min(8, { error: "পাসওয়ার্ডে অন্তত ৮টি অক্ষর লাগবে।" })
  .max(128, { error: "পাসওয়ার্ড ১২৮ অক্ষরের মধ্যে রাখুন।" })
  .regex(/[A-Za-z]/, { error: "অন্তত একটি ইংরেজি বর্ণ দিন।" })
  .regex(/[0-9]/, { error: "অন্তত একটি সংখ্যা দিন।" });

export const RegisterSchema = z
  .object({
    name: z.string().trim().min(2, { error: "পুরো নাম লিখুন (অন্তত ২ অক্ষর)।" }).max(80, { error: "নাম ৮০ অক্ষরের মধ্যে রাখুন।" }),
    email,
    password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { error: "দুটি পাসওয়ার্ড মেলেনি।", path: ["confirm"] });

export const LoginSchema = z.object({
  email,
  password: z.string().min(1, { error: "পাসওয়ার্ড লিখুন।" }),
});

export const ResetRequestSchema = z.object({ email });

export const ResetSchema = z
  .object({ token: z.string().min(20), password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { error: "দুটি পাসওয়ার্ড মেলেনি।", path: ["confirm"] });

export type FormState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
  values?: Record<string, string>;
} | undefined;
