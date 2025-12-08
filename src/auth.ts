import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema, isEmail } from "@/lib/validations/auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { identifier, password } = parsed.data;

        // Check if identifier is an email (vendor) or username (staff)
        if (isEmail(identifier)) {
          // Try to find vendor by email
          const customer = await prisma.customer.findUnique({
            where: { email: identifier },
          });

          if (customer && customer.is_vendor && customer.password_hash) {
            const isValidPassword = await bcrypt.compare(password, customer.password_hash);
            if (isValidPassword) {
              return {
                id: customer.customer_id.toString(),
                name: customer.name,
                email: customer.email,
                role: "VENDOR" as const,
                userType: "vendor" as const,
              };
            }
          }
        } else {
          // Try to find staff by username
          const user = await prisma.user.findUnique({
            where: { username: identifier },
          });

          if (user) {
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (isValidPassword) {
              return {
                id: user.user_id.toString(),
                name: user.username,
                role: user.role,
                userType: "staff" as const,
              };
            }
          }
        }

        // If no match found with the primary method, try the alternative
        // This handles edge cases where a staff might use email format username
        // or other special cases
        
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role!;
        token.userType = user.userType!;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.userType = token.userType as "staff" | "vendor";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
