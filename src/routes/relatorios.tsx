import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Calendar } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatório Geral · Métricas de operação e vendas" },
      {
        name: "description",
        content:
          "Relatórios do Omni com gráficos de vendas, atendimentos e tabelas prontas para exportação.",
      },
      { property: "og:title", content: "Relatório Geral · Métricas no Omni" },
      {
        property: "og:description",
        content: "Filtros de período, gráficos comparativos e exportação em um clique.",
      },
    ],
  }),
  component: Relatorios,
});

const perf = [
  { m: "Fev", vendas: 51, atendimentos: 120 },
  { m: "Mar", vendas: 47, atendimentos: 138 },
  { m: "Abr", vendas: 63, atendimentos: 145 },
  { m: "Mai", vendas: 58, atendimentos: 132 },
  { m: "Jun", vendas: 74, atendimentos: 161 },
  { m: "Jul", vendas: 84, atendimentos: 174 },
];

const origem = [
  { name: "Inbound", value: 42, color: "var(--primary)" },
  { name: "Outbound", value: 28, color: "var(--accent)" },
  { name: "Indicação", value: 19, color: "var(--chart-3)" },
  { name: "Upsell", value: 11, color: "var(--chart-5)" },
];

const perdas = [
  { motivo: "Preço acima do orçamento", qtd: 12 },
  { motivo: "Sem retorno do cliente", qtd: 9 },
  { motivo: "Escolheu concorrente", qtd: 6 },
  { motivo: "Sem fit com o produto", qtd: 4 },
];

const rows = [
  ["Ana Ribeiro", "18", "R$ 96.400", "31%", "R$ 5.355"],
  ["Lucas Mota", "14", "R$ 71.200", "27%", "R$ 5.085"],
  ["João Prado", "11", "R$ 52.900", "24%", "R$ 4.809"],
];

function Relatorios() {
  return (
    <AppShell
      title="Relatório Geral"
      subtitle="Fev — Jul de 2026"
      actions={
        <button className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-px">
          <Download className="size-4" /> Exportar
        </button>
      }
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="size-4 text-accent" /> Período
          </span>
          {["7 dias", "30 dias", "Trimestre", "Ano", "Personalizado"].map((p, i) => (
            <button
              key={p}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                i === 3 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {p}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            {["Equipe", "Origem", "Etapa"].map((f) => (
              <select
                key={f}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
              >
                <option>{f}: todos</option>
              </select>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Negócios ganhos", "43"],
            ["Receita gerada", "R$ 220.500"],
            ["Atendimentos", "870"],
            ["Tempo médio de resposta", "12 min"],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{l}</p>
              <p className="mt-2 text-3xl font-extrabold">{v}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] xl:col-span-2">
            <h2 className="text-base font-bold">Vendas x Atendimentos</h2>
            <p className="text-xs text-muted-foreground">Comparativo mensal</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perf} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                  <Line dataKey="vendas" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3 }} />
                  <Line dataKey="atendimentos" stroke="var(--accent)" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold">Origem dos negócios</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={origem} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={3}>
                    {origem.map((o) => (
                      <Cell key={o.name} fill={o.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {origem.map((o) => (
                <li key={o.name} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: o.color }} />
                  <span className="flex-1">{o.name}</span>
                  <span className="font-semibold">{o.value}%</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold">Motivos de perda</h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perdas} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="motivo" type="category" width={130} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip cursor={{ fill: "var(--secondary)" }} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="qtd" fill="var(--accent)" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card xl:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-bold">Desempenho por responsável</h2>
              <button className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary">
                <FileSpreadsheet className="size-4" /> Exportar CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Responsável</th>
                  <th className="px-6 py-3">Ganhos</th>
                  <th className="px-6 py-3">Receita</th>
                  <th className="px-6 py-3">Conversão</th>
                  <th className="px-6 py-3 text-right">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r[0]} className="border-t border-border hover:bg-secondary/60">
                    <td className="px-6 py-3 font-semibold">{r[0]}</td>
                    <td className="px-6 py-3">{r[1]}</td>
                    <td className="px-6 py-3 font-semibold text-primary">{r[2]}</td>
                    <td className="px-6 py-3">
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                        {r[3]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">{r[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
