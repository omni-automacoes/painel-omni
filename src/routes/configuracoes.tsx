import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2, User, Users, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · Usuários e motivos de perda no Omni" },
      {
        name: "description",
        content:
          "Gerencie seu perfil, a equipe com acesso e os motivos de perda do funil comercial no Omni.",
      },
      { property: "og:title", content: "Configurações do Omni" },
      {
        property: "og:description",
        content: "Perfil, usuários e motivos de perda organizados em abas simples.",
      },
    ],
  }),
  component: Configuracoes,
});

const TABS = [
  { id: "perfil", label: "Meu perfil", Icon: User },
  { id: "usuarios", label: "Usuários", Icon: Users },
  { id: "perdas", label: "Motivos de perda", Icon: XCircle },
] as const;

const users = [
  ["Ana Ribeiro", "ana@omni.com", "Administradora", "Ativo"],
  ["Lucas Mota", "lucas@omni.com", "Vendedor", "Ativo"],
  ["João Prado", "joao@omni.com", "Financeiro", "Ativo"],
  ["Bianca Alves", "bianca@omni.com", "Atendimento", "Convite pendente"],
];

const motivos = [
  ["Preço acima do orçamento", "Comercial", "12 usos"],
  ["Sem retorno do cliente", "Relacionamento", "9 usos"],
  ["Escolheu concorrente", "Comercial", "6 usos"],
  ["Sem fit com o produto", "Qualificação", "4 usos"],
];

function Configuracoes() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("perfil");

  return (
    <AppShell title="Configurações" subtitle="Conta, equipe e parâmetros do funil">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6 flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                tab === t.id
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.Icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "perfil" && (
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
              <span className="mx-auto grid size-20 place-items-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">
                AR
              </span>
              <p className="mt-3 text-lg font-bold">Ana Ribeiro</p>
              <p className="text-sm text-muted-foreground">Administradora</p>
              <button className="mt-4 w-full rounded-lg border border-primary py-2 text-sm font-semibold text-primary">
                Trocar foto
              </button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Informações do usuário</h2>
                <button className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground">
                  <Pencil className="size-4" /> Editar
                </button>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  ["Nome completo", "Ana Ribeiro"],
                  ["E-mail", "ana@omni.com"],
                  ["Telefone", "(11) 99120-4488"],
                  ["Cargo", "Administradora"],
                  ["Empresa", "Omni Gestão LTDA"],
                  ["Fuso horário", "GMT-3 · São Paulo"],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {l}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3 border-t border-border pt-5">
                <button className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
                  Alterar senha
                </button>
                <button className="rounded-lg border border-destructive px-4 py-2 text-sm font-semibold text-destructive">
                  Encerrar sessões
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "usuarios" && (
          <Panel
            title="Usuários com acesso"
            desc="Adicione pessoas da equipe e defina o nível de permissão."
            cta="Adicionar usuário"
            head={["Nome", "E-mail", "Perfil", "Status", ""]}
          >
            {users.map((u) => (
              <tr key={u[1]} className="border-t border-border hover:bg-secondary/60">
                <td className="px-6 py-3 font-semibold">{u[0]}</td>
                <td className="px-6 py-3 text-muted-foreground">{u[1]}</td>
                <td className="px-6 py-3">
                  <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                    {u[2]}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      u[3] === "Ativo"
                        ? "bg-success/12 text-success"
                        : "bg-accent-soft text-accent-foreground",
                    )}
                  >
                    {u[3]}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <div className="flex justify-end gap-2 text-muted-foreground">
                    <button className="rounded-md p-1.5 hover:bg-secondary hover:text-foreground">
                      <Pencil className="size-4" />
                    </button>
                    <button className="rounded-md p-1.5 hover:bg-secondary hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Panel>
        )}

        {tab === "perdas" && (
          <Panel
            title="Motivos de perda"
            desc="Usados quando um negócio é marcado como perdido no funil."
            cta="Novo motivo"
            head={["Motivo", "Categoria", "Frequência", ""]}
          >
            {motivos.map((m) => (
              <tr key={m[0]} className="border-t border-border hover:bg-secondary/60">
                <td className="px-6 py-3 font-semibold">{m[0]}</td>
                <td className="px-6 py-3 text-muted-foreground">{m[1]}</td>
                <td className="px-6 py-3">
                  <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                    {m[2]}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <div className="flex justify-end gap-2 text-muted-foreground">
                    <button className="rounded-md p-1.5 hover:bg-secondary hover:text-foreground">
                      <Pencil className="size-4" />
                    </button>
                    <button className="rounded-md p-1.5 hover:bg-secondary hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Panel>
        )}
      </div>
    </AppShell>
  );
}

function Panel({
  title,
  desc,
  cta,
  head,
  children,
}: {
  title: string;
  desc: string;
  cta: string;
  head: string[];
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-px">
          <Plus className="size-4" /> {cta}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={cn("px-6 py-3", i === head.length - 1 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}
