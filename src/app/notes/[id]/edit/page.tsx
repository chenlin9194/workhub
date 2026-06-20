import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import NoteForm from "@/components/NoteForm";

export const dynamic = "force-dynamic";

export default async function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = await prisma.note.findUnique({ where: { id } });

  if (!note) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">编辑记录</h1>
      <NoteForm
        mode="edit"
        noteId={note.id}
        initialData={{
          title: note.title,
          content: note.content,
          project: note.project || "",
          module: note.module || "",
          type: note.type,
          priority: note.priority,
          status: note.status,
          owner: note.owner || "",
          dueDate: note.dueDate || "",
          source: note.source,
          tags: note.tags || "",
        }}
      />
    </div>
  );
}
