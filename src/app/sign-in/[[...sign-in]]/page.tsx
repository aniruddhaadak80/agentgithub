import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="shell auth-shell">
        <section className="panel detail-header">
          <h1>Clerk is not configured.</h1>
          <p>Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to enable sign-in.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell auth-shell">
      <section className="auth-hosted reveal-up">
        <SignIn signUpUrl="/sign-up" />
      </section>
    </main>
  );
}