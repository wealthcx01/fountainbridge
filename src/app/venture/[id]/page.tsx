import Link from "next/link";
import { getSessionEmail } from "@/lib/session";
import { getScopedVenture } from "@/lib/ventures";
import { SignInPrompt } from "@/components/SignInPrompt";
import { NotAuthorized } from "@/components/NotAuthorized";

export default async function VenturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const email = await getSessionEmail();
  if (!email) return <SignInPrompt />;

  // Server-side scoping: a session may never read a venture it doesn't own (non-negotiable 6).
  const venture = getScopedVenture(email, id);
  if (!venture) return <NotAuthorized ventureId={id} />;

  return (
    <section>
      <p style={{ margin: 0 }}>
        <Link href="/" className="mono" style={{ fontSize: "0.72rem", color: "var(--color-ink-muted)" }}>
          ← Ventures
        </Link>
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginTop: "0.5rem" }}>
        <h1 style={{ margin: 0 }}>{venture.name}</h1>
        <span className="tag" data-tone={venture.status === "active" ? "accent" : undefined}>
          {venture.status ?? "draft"}
        </span>
      </div>
      <p className="mono" style={{ fontSize: "0.75rem", color: "var(--color-ink-muted)" }}>
        {venture.id} · founder {venture.founder.name} ({venture.founder.workspace_email})
      </p>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr", marginTop: "1.5rem" }}>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span className="eyebrow">Lanes</span>
          {venture.lanes?.length ? (
            <ul style={{ paddingLeft: "1.1rem", margin: "0.5rem 0 0" }}>
              {venture.lanes.map((l) => (
                <li key={l.id} style={{ marginBottom: "0.35rem" }}>
                  <span className="mono" style={{ fontSize: "0.8rem" }}>{l.id}</span>{" "}
                  <span className="tag">{l.status ?? "idle"}</span>
                  <br />
                  <span style={{ color: "var(--color-ink-muted)", fontSize: "0.82rem" }}>{l.repo}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "var(--color-ink-faint)" }}>No lanes yet.</p>
          )}
        </div>

        <div className="card" style={{ padding: "1.25rem" }}>
          <span className="eyebrow">Departments</span>
          {venture.departments?.length ? (
            <ul style={{ paddingLeft: "1.1rem", margin: "0.5rem 0 0" }}>
              {venture.departments.map((d) => (
                <li key={d.id} style={{ marginBottom: "0.35rem" }}>
                  {d.name} <span className="tag" data-tone={d.gate === "activegraph" ? "warn" : undefined}>
                    gate: {d.gate}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "var(--color-ink-faint)" }}>No departments yet.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <span className="eyebrow">Approval matrix (D7)</span>
        <table className="mono" style={{ width: "100%", fontSize: "0.82rem", marginTop: "0.5rem", borderCollapse: "collapse" }}>
          <tbody>
            {(venture.approval_matrix ?? []).map((r) => (
              <tr key={r.change_class} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: "0.35rem 0", color: "var(--color-ink-soft)" }}>{r.change_class}</td>
                <td style={{ padding: "0.35rem 0", textAlign: "right", color: "var(--color-accent)" }}>{r.approver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: "var(--color-ink-faint)", fontSize: "0.82rem", marginTop: "1.5rem" }}>
        Lanes, tickets, the attention queue, and activity land in FB-006 / FB-007 / FB-008.
      </p>
    </section>
  );
}
