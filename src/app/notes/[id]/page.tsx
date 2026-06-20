import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import NoteDetailClient from "./NoteDetailClient";

export const dynamic = "force-dynamic";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = await prisma.note.findUnique({ where: { id } });

  if (!note) {
    notFound();
  }

  return <NoteDetailClient note={note} />;
}
