import { notFound } from "next/navigation";
import {
  ApiPanel,
  ResourcePanel,
  UsagePanel,
} from "@/components/untrack/resources";
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (
    ![
      "clients",
      "domains",
      "members",
      "usage",
      "audit",
      "api",
      "folders",
    ].includes(module)
  )
    notFound();
  return (
    <section className="shell page-section">
      {module === "usage" ? (
        <UsagePanel />
      ) : module === "api" ? (
        <ApiPanel />
      ) : (
        <ResourcePanel key={module} module={module} />
      )}
    </section>
  );
}
