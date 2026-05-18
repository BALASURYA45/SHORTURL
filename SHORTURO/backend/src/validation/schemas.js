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

module.exports = { signupSchema, loginSchema };

