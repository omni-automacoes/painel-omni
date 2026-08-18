import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Plus,
  X,
  Building2,
  Phone,
  Mail,
  CalendarDays,
  MoreHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/negocios")({
  head: () => ({
    meta: [
      { title: "Negócios · Funil de vendas no Omni" },
      {
        name: "description",
        content:
          "Quadro Kanban de negócios do Omni: acompanhe cada oportunidade da prospecção ao fechamento.",
      },
      { property: "og:title", content: "Negócios · Funil de vendas no Omni" },
      {
        property: "og:description",
        content: "Kanban de oportunidades, filtros e ficha completa de cada negócio.",
      },
    ],
  }),
  component: Negocios,
});

type Deal = {
  id: string;
  title: string;
  company: string;
  value: string;
  owner: string;
  due: string;
  tag: string;
  hot?: boolean;
};

const columns: { stage: string; total: string; deals: Deal[] }[] = [
  {
    stage: "Prospecção",
    total: "R$ 42.000",
    deals: [
      { id: "1", title: "Implantação de sistema", company: "Padaria Aurora", value: "R$ 12.000", owner: "AR", due: "05 ago", tag: "Inbound" },
      { id: "2", title: "Consultoria mensal", company: "Studio Vega", value: "R$ 8.400", owner: "LM", due: "07 ago", tag: "Indicação" },
      { id: "3", title: "Pacote anual", company: "Óptica Lumen", value: "R$ 21.600", owner: "AR", due: "12 ago", tag: "Outbound" },
    ],
  },
  {
    stage: "Qualificação",
    total: "R$ 33.500",
    deals: [
      { id: "4", title: "Migração de dados", company: "Móveis Duran", value: "R$ 15.500", owner: "JP", due: "03 ago", tag: "Inbound", hot: true },
      { id: "5", title: "Licenças extras", company: "Clínica Sena", value: "R$ 18.000", owner: "LM", due: "09 ago", tag: "Upsell" },
    ],
  },
  {
    stage: "Proposta",
    total: "R$ 56.900",
    deals: [
      { id: "6", title: "Plano Omni Pro", company: "Auto Center Rex", value: "R$ 26.900", owner: "AR", due: "02 ago", tag: "Outbound", hot: true },
      { id: "7", title: "Treinamento de equipe", company: "Escola Prisma", value: "R$ 30.000", owner: "JP", due: "14 ago", tag: "Inbound" },
    ],
  },
  {
    stage: "Negociação",
    total: "R$ 47.200",
    deals: [
      { id: "8", title: "Contrato 24 meses", company: "Transportes Vila", value: "R$ 47.200", owner: "LM", due: "01 ago", tag: "Renovação", hot: true },
    ],
  },
  {
    stage: "Ganho",
    total: "R$ 61.000",
    deals: [
      { id: "9", title: "Plano Omni Start", company: "Pet Shop Nino", value: "R$ 9.000", owner: "AR", due: "28 jul", tag: "Inbound" },
      { id: "10", title: "Expansão de filiais", company: "Rede Bom Café", value: "R$ 52.000", owner: "JP", due: "26 jul", tag: "Upsell" },
    ],
  },
];

function Negocios() {
  const [open, setOpen] = useState<Deal | null>(null);

  return (
    <AppShell
      title="Negócios"
      subtitle="Funil comercial · 10 oportunidades ativas"
      actions={
        <button className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-px">
          <Plus className="size-4" /> Novo negócio
        </button>
      }
      flush
    >
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
          <div className="relative min-w-[220px] flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Buscar negócio, empresa ou contato"
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          {["Responsável", "Origem", "Valor", "Período"].map((f) => (
            <button
              key={f}
              className="h-9 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
            >
              {f}
            </button>
          ))}
          <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary px-3 text-sm font-semibold text-primary">
            <SlidersHorizontal className="size-4" /> Filtros avançados
          </button>
          <span className="ml-auto text-sm text-muted-foreground">
            Total no funil: <strong className="text-foreground">R$ 240.600</strong>
          </span>
        </div>

        <div className="flex flex-1 gap-4 overflow-x-auto scrollbar-slim p-6">
          {columns.map((col) => (
            <div key={col.stage} className="flex w-[300px] shrink-0 flex-col">
              <div className="flex items-center justify-between rounded-t-xl border-b-2 border-accent bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-bold">{col.stage}</p>
                  <p className="text-xs text-muted-foreground">
                    {col.deals.length} negócios · {col.total}
                  </p>
                </div>
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </div>
              <div className="flex flex-1 flex-col gap-3 rounded-b-xl bg-secondary/60 p-3">
                {col.deals.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setOpen(d)}
                    className="rounded-xl border border-border bg-card p-4 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{d.title}</p>
                      {d.hot && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                          Quente
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="size-3.5" /> {d.company}
                    </p>
                    <p className="mt-3 text-lg font-extrabold text-primary">{d.value}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {d.tag}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" /> {d.due}
                        <span className="grid size-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {d.owner}
                        </span>
                      </span>
                    </div>
                  </button>
                ))}
                <button className="rounded-xl border border-dashed border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-accent hover:text-foreground">
                  + Adicionar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {open && <DealDrawer deal={open} onClose={() => setOpen(null)} />}
    </AppShell>
  );
}

function DealDrawer({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-foreground/40 backdrop-blur-[2px]">
      <button className="flex-1" onClick={onClose} aria-label="Fechar" />
      <aside className="flex h-full w-full max-w-[560px] flex-col bg-card shadow-[var(--shadow-pop)]">
        <header className="bg-primary px-6 py-5 text-primary-foreground">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-primary-foreground/70">
                {deal.company}
              </p>
              <h2 className="text-xl font-extrabold">{deal.title}</h2>
              <p className="mt-1 text-2xl font-extrabold text-accent">{deal.value}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
              <X className="size-5" />
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground">
              Marcar como ganho
            </button>
            <button className="rounded-lg border border-white/30 px-3 py-1.5 text-sm font-semibold">
              Registrar perda
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-slim p-6">
          <section className="rounded-xl border border-border p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Dados do cliente
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Contato</dt>
                <dd className="font-medium">Marina Costa</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Responsável</dt>
                <dd className="font-medium">Ana Ribeiro</dd>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-accent" />
                <span className="font-medium">(11) 98844-2210</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-accent" />
                <span className="truncate font-medium">marina@empresa.com</span>
              </div>
            </dl>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Histórico da negociação
            </h3>
            <ol className="mt-3 space-y-4 border-l-2 border-border pl-5">
              {[
                ["Hoje, 09:12", "Proposta enviada por e-mail", "Ana Ribeiro"],
                ["Ontem, 15:40", "Reunião de descoberta realizada", "Ana Ribeiro"],
                ["28 jul", "Negócio movido para Qualificação", "Sistema"],
                ["26 jul", "Negócio criado a partir do formulário do site", "Sistema"],
              ].map(([when, what, who]) => (
                <li key={what} className="relative">
                  <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-card bg-accent" />
                  <p className="text-sm font-semibold">{what}</p>
                  <p className="text-xs text-muted-foreground">
                    {when} · {who}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="border-t border-border p-4">
          <input
            placeholder="Registrar uma anotação…"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </footer>
      </aside>
    </div>
  );
}
