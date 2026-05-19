const { z } = require("zod");

const emailSchema = z.string().email().min(3).max(320);
const passwordSchema = z.string().min(8).max(200);

const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200)
});

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9_-]+$/, "Alias may contain only letters, numbers, _ and -");

const createLinkSchema = z.object({
  originalUrl: z.string().url().max(2048),
  customSlug: slugSchema.optional(),
  expiresAt: z
    .union([z.string().datetime(), z.null()])
    .optional()
});

const updateLinkSchema = z
  .object({
    originalUrl: z.string().url().max(2048).optional(),
    customSlug: slugSchema.optional(),
    expiresAt: z.union([z.string().datetime(), z.null()]).optional()
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

const bulkCreateLinksSchema = z.object({
  items: z
    .array(
      z.object({
        originalUrl: z.string().url().max(2048),
        customSlug: slugSchema.optional(),
        expiresAt: z.union([z.string().datetime(), z.null()]).optional()
      })
    )
    .min(1)
    .max(200)
});

module.exports = { signupSchema, loginSchema, createLinkSchema, updateLinkSchema, bulkCreateLinksSchema };
