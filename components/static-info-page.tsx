import Link from "next/link";

type InfoSection = {
  title: string;
  description: string;
  href?: string;
  action?: string;
};

export function StaticInfoPage({
  eyebrow,
  title,
  description,
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: readonly InfoSection[];
}) {
  return (
    <section className="static-page">
      <div className="shell">
        <div className="static-page-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="static-page-grid">
          {sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.description}</p>
              {section.href && (
                <Link className="text-link" href={section.href}>
                  {section.action ?? "Abrir"}
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
