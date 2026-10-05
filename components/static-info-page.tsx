import Link from "next/link";

type InfoSection = {
  title: string;
  description?: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
  href?: string;
  action?: string;
};

export function StaticInfoPage({
  eyebrow,
  title,
  description,
  sections,
  variant = "grid",
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: readonly InfoSection[];
  variant?: "grid" | "document";
}) {
  return (
    <section className="static-page">
      <div className="shell">
        <div className="static-page-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={`static-page-grid static-page-grid--${variant}`}>
          {sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              {section.description && <p>{section.description}</p>}
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
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
