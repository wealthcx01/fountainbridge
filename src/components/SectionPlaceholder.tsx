import { getSessionEmail } from "@/lib/session";
import { venturesForUser } from "@/lib/ventures";
import { SignInPrompt } from "@/components/SignInPrompt";

// A signed-in-scoped placeholder for the studio sections that land in later tickets. Keeps the
// nav honest (every item routes somewhere) while making clear what's coming and when.
export async function SectionPlaceholder({
  eyebrow,
  title,
  blurb,
  ticket,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  ticket: string;
}) {
  const email = await getSessionEmail();
  if (!email) return <SignInPrompt />;
  const ventures = venturesForUser(email);

  return (
    <section className="measure">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p style={{ color: "var(--color-ink-soft)" }}>{blurb}</p>
      <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>
        Scoped to {ventures.length} venture{ventures.length === 1 ? "" : "s"}. This view arrives in{" "}
        <span className="tag" data-tone="accent">{ticket}</span>.
      </p>
    </section>
  );
}
