import { useState } from "react";
import { useAuth } from "../lib/auth";
import { EditableText } from "./editable-text";

export function AuthCard() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const error =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password, displayName);

    if (error) {
      setMessage(`Erro: ${error}`);
    } else if (mode === "register") {
      setMessage("Conta criada. Verifique seu e-mail para confirmar o acesso.");
    }

    setSubmitting(false);
  };

  return (
    <section className="panel space-y-4 p-5">
      <div>
        <h2 className="text-base font-bold uppercase tracking-wide">
          <EditableText
            as="span"
            entry={{ id: "auth-title", label: "Auth • título", defaultText: "Entrar no painel" }}
          />
        </h2>
        <p className="text-xs text-muted-foreground">
          <EditableText
            as="span"
            entry={{
              id: "auth-subtitle",
              label: "Auth • descrição",
              defaultText: "Fundador/Admin podem configurar a conexão; Usuário vê banimentos gerais.",
              defaultConfig: { uppercase: false, font: "Exo 2", size: 13, weight: "500" },
            }}
          />
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="action-button"
          onClick={() => {
            setMode("login");
            setMessage(null);
          }}
        >
          <EditableText as="span" entry={{ id: "auth-login", label: "Auth • botão login", defaultText: "Login" }} />
        </button>
        <button
          type="button"
          className="action-button"
          onClick={() => {
            setMode("register");
            setMessage(null);
          }}
        >
          <EditableText
            as="span"
            entry={{ id: "auth-register", label: "Auth • botão cadastro", defaultText: "Cadastro" }}
          />
        </button>
      </div>

      <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit}>
        {mode === "register" && (
          <label className="space-y-1 text-xs text-muted-foreground">
            Nome de exibição
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring focus:ring-2"
            />
          </label>
        )}

        <label className="space-y-1 text-xs text-muted-foreground">
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring focus:ring-2"
          />
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          Senha
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="******"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring focus:ring-2"
          />
        </label>

        <div className="md:col-span-3">
          <button type="submit" className="action-button" disabled={submitting}>
            {submitting ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </div>
      </form>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </section>
  );
}