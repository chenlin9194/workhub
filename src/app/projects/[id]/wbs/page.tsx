import WbsOverviewClient from "@/components/WbsOverviewClient";

export default async function ProjectWbsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WbsOverviewClient projectId={id} />;
}
