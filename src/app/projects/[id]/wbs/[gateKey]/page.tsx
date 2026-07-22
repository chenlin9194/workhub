import WbsGateClient from "@/components/WbsGateClient";

export default async function ProjectWbsGatePage({ params }: { params: Promise<{ id: string; gateKey: string }> }) {
  const { id, gateKey } = await params;
  return <WbsGateClient projectId={id} gateKey={gateKey.toUpperCase()} />;
}
