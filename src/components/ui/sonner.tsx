import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/ThemeProvider";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/* Avisos flutuantes no contrato `.omni-toast`: superfície, borda de 1px,
   raio 10px e sombra `lg` — a sombra é permitida porque o toast flutua. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:border-line group-[.toaster]:bg-surface group-[.toaster]:text-ink group-[.toaster]:shadow-lg group-[.toaster]:font-sans",
          title: "group-[.toast]:text-base group-[.toast]:font-semibold group-[.toast]:text-ink",
          description: "group-[.toast]:text-xs group-[.toast]:text-ink-3",
          actionButton:
            "group-[.toast]:rounded-md group-[.toast]:bg-primary group-[.toast]:text-primary-fg group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:rounded-md group-[.toast]:bg-surface-3 group-[.toast]:text-ink-2 group-[.toast]:font-semibold",
          success: "group-[.toaster]:text-success",
          error: "group-[.toaster]:text-danger",
          warning: "group-[.toaster]:text-warning",
          info: "group-[.toaster]:text-info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
