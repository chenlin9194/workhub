export function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

export function formatDate(date: string | Date, format: "short" | "full" | "iso" = "short") {
  const d = new Date(date);
  if (format === "iso") return d.toISOString().split("T")[0];
  if (format === "full") return d.toLocaleString("zh-CN");
  return d.toLocaleDateString("zh-CN");
}

export function formatTodayStr() {
  return new Date().toLocaleDateString("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
}

export function groupNotes(notes: { type: string; status: string }[]) {
  const completed = notes.filter(
    (n) => n.status === "closed" && ["todo", "issue", "blocker"].includes(n.type)
  );
  const todos = notes.filter((n) => n.type === "todo" && n.status !== "closed");
  const risks = notes.filter((n) => n.type === "risk");
  const blockers = notes.filter((n) => n.type === "blocker" && n.status !== "closed");
  const decisions = notes.filter((n) => n.type === "decision");
  const meetings = notes.filter((n) => n.type === "meeting");
  const issues = notes.filter((n) => n.type === "issue" && n.status !== "closed");
  const others = notes.filter(
    (n) =>
      !["todo", "risk", "blocker", "decision", "meeting", "issue"].includes(n.type) ||
      ((n.type === "todo" || n.type === "issue") && n.status === "closed")
  );

  return [
    { title: "今日完成", items: completed, icon: "check-circle" },
    { title: "待办事项", items: todos, icon: "clipboard-list" },
    { title: "风险", items: risks, icon: "alert-triangle" },
    { title: "阻塞", items: blockers, icon: "shield-off" },
    { title: "决策", items: decisions, icon: "lightbulb" },
    { title: "会议记录", items: meetings, icon: "users" },
    { title: "问题跟进", items: issues, icon: "search" },
    { title: "其他记录", items: others, icon: "file-text" },
  ].filter((g) => g.items.length > 0);
}

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}
