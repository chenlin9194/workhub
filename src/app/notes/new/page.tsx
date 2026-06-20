import NoteForm from "@/components/NoteForm";

export default function NewNotePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">新增记录</h1>
      <NoteForm mode="create" />
    </div>
  );
}
