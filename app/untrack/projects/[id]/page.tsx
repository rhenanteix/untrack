import { ProjectOverview } from "@/components/untrack/project-overview";

export const metadata = { title: "Projeto" };

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ProjectOverview params={params} />;
}