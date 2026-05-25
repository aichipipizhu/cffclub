import { z } from "zod";

export const unitPriceYuanSchema = z.number().positive();

export const startOrderSchema = z.object({
  customerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerWechat: z.string().optional(),
  newCustomerNote: z.string().optional(),
  categoryId: z.string().min(1),
  unitPriceYuan: unitPriceYuanSchema,
  startAt: z.string().datetime().optional(),
});

export const joinOrderSchema = z.object({
  unitPriceYuan: unitPriceYuanSchema,
  startAt: z.string().datetime().optional(),
});
