import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  CircleDot,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Omni · Visão Geral da sua empresa" },
      {
        name: "description",
        content:
          "Painel Omni com vendas, tarefas e financeiro da sua pequena empresa em uma única tela.",
      },
      { property: "og:title", content: "Omni · Visão Geral da sua empresa" },
      {
        property: "og:description",
        content: "Vendas, atendimentos, tarefas e financeiro centralizados no Omni.",
      },
    ],
  }),
  component: Dashboard,
});

const kpis = [
  { label: "Receita do mês", value: "R$ 84.320", delta: "+12,4%", up: true },
  { label: "Negócios abertos", value: "37", delta: "+5 esta semana", up: true },
  { label: "Ticket médio", value: "R$ 2.280", delta: "-3,1%", up: false },
  { label: "Taxa de conversão", value: "28%", delta: "+2,0 p.p.", up: true },
];

const revenue = [
  { m: "Jan", receita: 42, meta: 40 },
  { m: "Fev", receita: 51, meta: 45 },
  { m: "Mar", receita: 47, meta: 50 },
  { m: "Abr", receita: 63, meta: 55 },
  { m: "Mai", receita: 58, meta: 60 },
  { m: "Jun", receita: 74, meta: 65 },
  { m: "Jul", receita: 84, meta: 70 },
];

const funnel = [
  { stage: "Prospecção", qty: 14, pct: 100 },
  { stage: "Qualificação", qty: 10, pct: 71 },
  { stage: "Proposta", qty: 7, pct: 50 },
  { stage: "Negociação", qty: 4, pct: 29 },
  { stage: "Ganho", qty: 3, pct: 21 },
];

const tasks = [
  { t: "Enviar proposta – Padaria Aurora", due: "Hoje, 16h", s: "andamento" },
  { t: "Ligar para Studio Vega", due: "Hoje, 18h", s: "pendente" },
  { t: "Conciliar boletos de julho", due: "Amanhã", s: "pendente" },
  { t: "Renovar contrato Móveis Duran", due: "Concluído", s: "concluido" },
];

const statusMap = {
  pendente: { label: "Pendente", cls: "bg-accent-soft text-accent-foreground", Icon: CircleDot },
  andamento: { label: "Em andamento", cls: "bg-primary-soft text-primary", Icon: Clock },
  concluido: { label: "Concluído", cls: "bg-success/12 text-success", Icon: CheckCircle2 },
} as const;

function Dashboard() {
  return (
    <AppShell
      title="Visão Geral"
      subtitle="Resumo de julho de 2026"
      actions={
        <button className="hidden items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-px sm:inline-flex">
          <Plus className="size-4" /> Novo negócio
        </button>
      }
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {k.label}
              </p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
                {k.value}
              </p>
              <p
                className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  k.up ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                {k.up ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {k.delta}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Receita x Meta</h2>
                <p className="text-xs text-muted-foreground">Últimos 7 meses (em milhares)</p>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-accent" /> Receita
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-primary" /> Meta
                </span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    dataKey="receita"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    fill="url(#g1)"
                  />
                  <Area
                    dataKey="meta"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold">Funil de negócios</h2>
            <p className="text-xs text-muted-foreground">Distribuição por etapa</p>
            <ul className="mt-5 space-y-4">
              {funnel.map((f) => (
                <li key={f.stage}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{f.stage}</span>
                    <span className="font-semibold text-muted-foreground">{f.qty}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${f.pct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Tarefas de hoje</h2>
              <span className="text-xs font-semibold text-accent-foreground">
                4 pendências
              </span>
            </div>
            <ul className="divide-y divide-border">
              {tasks.map((t) => {
                const s = statusMap[t.s as keyof typeof statusMap];
                return (
                  <li key={t.t} className="flex items-center gap-3 py-3">
                    <s.Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.t}</span>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {t.due}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-primary p-6 text-primary-foreground shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold">Financeiro do mês</h2>
            <p className="text-xs text-primary-foreground/70">Fechamento parcial</p>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs text-primary-foreground/70">Receitas</p>
                <p className="text-2xl font-extrabold">R$ 84.320</p>
              </div>
              <div>
                <p className="text-xs text-primary-foreground/70">Despesas</p>
                <p className="text-2xl font-extrabold">R$ 51.140</p>
              </div>
              <div className="rounded-xl bg-accent p-4 text-accent-foreground">
                <p className="text-xs font-semibold uppercase tracking-wide">Saldo</p>
                <p className="text-2xl font-extrabold">R$ 33.180</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
