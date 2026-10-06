import Link from "next/link";
import { getSessionEmail } from "@/lib/session";
import { isAdmin, venturesForUser } from "@/lib/ventures";
import { SignInPrompt } from "@/components/SignInPrompt";

export default async function Home() {
  const email = await getSessionEmail();
  if (!email) {
    return <SignInPrompt />;
  }

  const ventures = venturesForUser(email);
  const admin = isAdmin(email);

  if (ventures.length === 0) {
    return (
      <section className="measure">
        <span className="eyebrow">Not authorized</span>
        <h1>No ventures for this account</h1>
        <p style={{ color: "var(--color-ink-soft)" }}>
          {email} isn&apos;t the founder of any venture, and isn&apos;t a Bruntsfield admin. If this
          is wrong, check the venture manifest&apos;s <code className="mono">founder.workspace_email</code>{" "}
          or the admin allowlist.
        </p>
        <p style={{ marginTop: "1.5rem" }}>
          <a href="/api/auth/logout" className="btn btn-secondary">
            Sign out
          </a>
        </p>
      </section>
    );
  }

  return (
    <section>
      <span className="eyebrow">
        {admin ? "All ventures — Bruntsfield" : "Your venture"}
      </span>
      <h1 style={{ marginBottom: "0.25rem" }}>Ventures</h1>
      <p style={{ color: "var(--color-ink-muted)", marginTop: 0 }}>
        {admin
          ? "You see every venture in the studio."
          : "You see the venture you found. Bruntsfield reviews platform and high-blast-radius changes."}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {ventures.map((v) => (
          <Link key={v.id} href={`/venture/${v.id}`} className="card-link" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>{v.name}</h3>
              <span className="tag" data-tone={v.status === "active" ? "accent" : undefined}>
                {v.status ?? "draft"}
              </span>
            </div>
            <p
              className="mono"
              style={{ fontSize: "0.72rem", color: "var(--color-ink-muted)", margin: "0.5rem 0 0" }}
            >
              {v.id}
            </p>
            <p style={{ color: "var(--color-ink-soft)", fontSize: "0.9rem", marginBottom: 0 }}>
              {(v.lanes?.length ?? 0)} lane{(v.lanes?.length ?? 0) === 1 ? "" : "s"} ·{" "}
              {(v.repos?.length ?? 0)} repo{(v.repos?.length ?? 0) === 1 ? "" : "s"} ·{" "}
              {(v.departments?.length ?? 0)} dept
              {(v.departments?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
