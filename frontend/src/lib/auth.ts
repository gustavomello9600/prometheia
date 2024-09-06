import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { login } from "./api";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        try {
          const response = await login(credentials.email, credentials.password);
          if (response.success) {
            return { 
              id: response.user.id, 
              email: response.user.email,
              access_token: response.access_token,
              refresh_token: response.refresh_token
            };
          }
          return null;
        } catch (error) {
          console.error("Login error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.access_token = user.access_token;
        token.refresh_token = user.refresh_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.access_token = token.access_token as string;
        session.refresh_token = token.refresh_token as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
};
