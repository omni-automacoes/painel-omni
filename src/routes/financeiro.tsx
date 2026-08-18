import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · Receitas e despesas no Omni" },
      {
        name: "description",
        content:
          "Controle mensal de receitas e despesas com gráfico anual de resultados no Omni.",
      },
      { property: "og:title", content: "Financeiro · Receitas e despesas no Omni" },
      {
        property: "og:description",
        content: "Veja entradas, saídas e o resultado do ano em uma só tela.",
      },
    ],
  }),
  component: Financeiro,
});

const year = [
  { m: "Jan", Receitas: 42, Despesas: 31 },
  { m: "Fev", Receitas: 51, Despesas: 34 },
  { m: "Mar", Receitas: 47, Despesas: 39 },
  { m: "Abr", Receitas: 63, Despesas: 41 },
  { m: "Mai", Receitas: 58, Despesas: 44 },
  { m: "Jun", Receitas: 74, Despesas: 48 },
  { m: "Jul", Receitas: 84, Despesas: 51 },
  { m: "Ago", Receitas: 0, Despesas: 0 },
];

const entries = [
  { d: "28/07", desc: "Plano Omni Pro · Auto Center Rex", cat: "Vendas", val: "R$ 26.900", tipo: "receita", st: "Recebido" },
  { d: "26/07", desc: "Assinatura mensal · Rede Bom Café", cat: "Recorrência", val: "R$ 4.300", tipo: "receita", st: "Recebido" },
  { d: "25/07", desc: "Folha de pagamento", cat: "Pessoal", val: "R$ 28.400", tipo: "despesa", st: "Pago" },
  { d: "22/07", desc: "Anúncios online", cat: "Marketing", val: "R$ 3.150", tipo: "despesa", st: "Pago" },
  { d: "20/07", desc: "Implantação · Clínica Sena", cat: "Serviços", val: "R$ 18.000", tipo: "receita", st: "A receber" },
  { d: "18/07", desc: "Aluguel do escritório", cat: "Estrutura", val: "R$ 6.800", tipo: "despesa", st: "Pago" },
];

function Financeiro() {
  return (
    <AppShell
      title="Financeiro"
      subtitle="Julho de 2026"
      actions={
        <button className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-px">
          <Plus className="size-4" /> Novo lançamento
        </button>
      }
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-1">
            <button className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-3 text-sm font-bold">Julho 2026</span>
            <button className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto scrollbar-slim">
            {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map(
              (m) => (
                <button
                  key={m}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    m === "Jul"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {m}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ArrowDownLeft className="size-4 text-success" /> Receitas do mês
            </p>
            <p className="mt-2 text-3xl font-extrabold text-success">R$ 84.320</p>
            <p className="mt-1 text-xs text-muted-foreground">R$ 18.000 ainda a receber</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ArrowUpRight className="size-4 text-destructive" /> Despesas do mês
            </p>
            <p className="mt-2 text-3xl font-extrabold text-destructive">R$ 51.140</p>
            <p className="mt-1 text-xs text-muted-foreground">Todas quitadas</p>
          </div>
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-[var(--shadow-card)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
              Resultado
            </p>
            <p className="mt-2 text-3xl font-extrabold text-accent">R$ 33.180</p>
            <p className="mt-1 text-xs text-primary-foreground/70">Margem de 39,4%</p>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Gráfico anual de resultados</h2>
              <p className="text-xs text-muted-foreground">2026 · valores em milhares de reais</p>
            </div>
            <button className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
              Exportar
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={year} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Receitas" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Despesas" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-base font-bold">Lançamentos de julho</h2>
            <div className="flex gap-1 rounded-lg border border-border p-0.5 text-sm">
              {["Todos", "Receitas", "Despesas"].map((f, i) => (
                <button
                  key={f}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium",
                    i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Descrição</th>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3">Situação</th>
                <th className="px-6 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.desc} className="border-t border-border hover:bg-secondary/60">
                  <td className="px-6 py-3 text-muted-foreground">{e.d}</td>
                  <td className="px-6 py-3 font-semibold">{e.desc}</td>
                  <td className="px-6 py-3 text-muted-foreground">{e.cat}</td>
                  <td className="px-6 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        e.st === "A receber"
                          ? "bg-accent-soft text-accent-foreground"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {e.st}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-6 py-3 text-right font-bold",
                      e.tipo === "receita" ? "text-success" : "text-destructive",
                    )}
                  >
                    {e.tipo === "receita" ? "+" : "−"} {e.val}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
