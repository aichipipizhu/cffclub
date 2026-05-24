import { z } from "zod";

export type RegistrationInput = {
  username: string;
  displayName: string;
  password: string;
};

const usernamePattern = /^[A-Za-z0-9_]{3,32}$/;

const registrationSchema = z
  .object({
    username: z
      .string()
      .trim()
      .regex(usernamePattern, "账号只能使用英文、数字、下划线，长度 3-32 位")
      .transform((value) => value.toLowerCase()),
    displayName: z
      .string()
      .trim()
      .min(1, "请填写昵称"),
    password: z.string().min(6, "密码至少 6 位"),
  })
  .strip();

export function parseRegistrationInput(input: unknown): RegistrationInput {
  return registrationSchema.parse(input);
}

export function registrationErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || "注册信息不正确";
  }

  return "注册失败";
}
