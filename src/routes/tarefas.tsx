import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, X, LayoutList, Columns3, CircleDot, Clock, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas · Organize a rotina da equipe no Omni" },
      {
        name: "description",
        content:
          "Lista e quadro de tarefas do Omni com filtros por prioridade, vencimento e responsável.",
      },
      { property: "og:title", content: "Tarefas · Organize a rotina da equipe" },
      {
        property: "og:description",
        content: "Status claros de pendente, em andamento e concluído para toda a equipe.",
      },
    ],
  }),
  component: Tarefas,
});

const STATUS = {
  pendente: { label: "Pendente", cls: "bg-accent-soft text-accent-foreground", dot: "bg-accent", Icon: CircleDot },
  andamento: { label: "Em andamento", cls: "bg-primary-soft text-primary", dot: "bg-primary", Icon: Clock },
  concluido: { label: "Concluído", cls: "bg-success/12 text-success", dot: "bg-success", Icon: CheckCircle2 },
} as const;

type S = keyof typeof STATUS;

const tasks: { t: string; deal: string; owner: string; due: string; prio: string; s: S }[] = [
  { t: "Enviar proposta comercial", deal: "Padaria Aurora", owner: "Ana Ribeiro", due: "Hoje · 16:00", prio: "Alta", s: "andamento" },
  { t: "Ligar para retomar contato", deal: "Studio Vega", owner: "Lucas Mota", due: "Hoje · 18:00", prio: "Alta", s: "pendente" },
  { t: "Conciliar boletos de julho", deal: "Financeiro", owner: "João Prado", due: "Amanhã", prio: "Média", s: "pendente" },
  { t: "Preparar treinamento de equipe", deal: "Escola Prisma", owner: "Ana Ribeiro", due: "05 ago", prio: "Média", s: "andamento" },
  { t: "Renovar contrato anual", deal: "Móveis Duran", owner: "Lucas Mota", due: "28 jul", prio: "Baixa", s: "concluido" },
  { t: "Atualizar tabela de preços", deal: "Interno", owner: "João Prado", due: "26 jul", prio: "Baixa", s: "concluido" },
];

function Tarefas() {
  const [form, setForm] = useState(false);
  const [view, setView] = useState<"lista" | "quadro">("lista");

  return (
    <AppShell
      title="Tarefas"
      subtitle="6 tarefas · 2 vencem hoje"
      actions={
        <button
          onClick={() => setForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-px"
        >
          <Plus className="size-4" /> Nova tarefa
        </button>
      }
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
          {["Prioridade", "Vencimento", "Responsável", "Status"].map((f) => (
            <select
              key={f}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
            >
              <option>{f}: todos</option>
            </select>
          ))}
          <div className="ml-auto flex rounded-lg border border-border p-0.5">
            {(["lista", "quadro"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium capitalize",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {v === "lista" ? <LayoutList className="size-4" /> : <Columns3 className="size-4" />}
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === "lista" ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3">Tarefa</th>
                  <th className="px-4 py-3">Vinculada a</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const s = STATUS[t.s];
                  return (
                    <tr key={t.t} className="border-t border-border hover:bg-secondary/60">
                      <td className="px-4 py-3">
                        <input type="checkbox" defaultChecked={t.s === "concluido"} className="size-4 accent-[oklch(0.786_0.148_68)]" />
                      </td>
                      <td className={cn("px-4 py-3 font-semibold", t.s === "concluido" && "text-muted-foreground line-through")}>
                        {t.t}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{t.deal}</td>
                      <td className="px-4 py-3">{t.owner}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.due}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-semibold",
                            t.prio === "Alta"
                              ? "bg-destructive/10 text-destructive"
                              : t.prio === "Média"
                                ? "bg-accent-soft text-accent-foreground"
                                : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {t.prio}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.cls)}>
                          <s.Icon className="size-3.5" /> {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(STATUS) as S[]).map((k) => (
              <div key={k} className="rounded-xl bg-secondary/60 p-3">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={cn("size-2.5 rounded-full", STATUS[k].dot)} />
                  <p className="text-sm font-bold">{STATUS[k].label}</p>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {tasks.filter((t) => t.s === k).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {tasks
                    .filter((t) => t.s === k)
                    .map((t) => (
                      <div key={t.t} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                        <p className="text-sm font-semibold">{t.t}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t.deal}</p>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{t.due}</span>
                          <span className="font-semibold">{t.owner}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && <TaskForm onClose={() => setForm(false)} />}
    </AppShell>
  );
}

function TaskForm({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-foreground/40 backdrop-blur-[2px]">
      <button className="flex-1" onClick={onClose} aria-label="Fechar" />
      <aside className="flex h-full w-full max-w-[440px] flex-col bg-card shadow-[var(--shadow-pop)]">
        <header className="flex items-center justify-between bg-primary px-6 py-4 text-primary-foreground">
          <h2 className="text-lg font-bold">Nova tarefa</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {[
            ["Título da tarefa", "Ex.: Enviar proposta para o cliente"],
            ["Descrição", "Detalhe o que precisa ser feito"],
          ].map(([l, p]) => (
            <div key={l}>
              <label className="text-sm font-semibold">{l}</label>
              <input
                placeholder={p}
                className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {["Prioridade", "Status", "Responsável", "Vencimento"].map((l) => (
              <div key={l}>
                <label className="text-sm font-semibold">{l}</label>
                <select className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent">
                  <option>Selecionar</option>
                </select>
              </div>
            ))}
          </div>
        </div>
        <footer className="flex gap-3 border-t border-border p-4">
          <button onClick={onClose} className="h-10 flex-1 rounded-lg border border-border text-sm font-semibold">
            Cancelar
          </button>
          <button className="h-10 flex-1 rounded-lg bg-accent text-sm font-bold text-accent-foreground">
            Salvar tarefa
          </button>
        </footer>
      </aside>
    </div>
  );
}
