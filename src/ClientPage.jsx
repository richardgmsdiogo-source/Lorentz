// src/ClientPage.jsx
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function formatCurrency(valor) {
  if (valor == null || isNaN(valor)) return "-";
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

// Storage bucket: documentos
function getDocumentoPublicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from("documentos").getPublicUrl(path);
  return data?.publicUrl || null;
}

async function buscarCliente(user) {
  // 1) por user_id
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) return data;
  } catch (err) {
    console.warn("[CLIENTE] erro buscando por user_id:", err);
  }

  // 2) fallback por e-mail
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    if (error) {
      console.warn("[CLIENTE] erro buscando por email:", error);
      return null;
    }
    return data || null;
  } catch (err) {
    console.error("[CLIENTE] erro inesperado buscando por email:", err);
    return null;
  }
}

// Busca papel do usuário (admin / cliente)
async function buscarRole(userId) {
  try {
    const { data, error } = await supabase
      .from("usuario_roles") // ajuste o nome da tabela se for outro
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[ROLE] erro buscando role:", error);
      return null;
    }
    return data?.role || null;
  } catch (err) {
    console.error("[ROLE] erro inesperado buscando role:", err);
    return null;
  }
}

/**
 * Resumo do evento para o header da área do cliente.
 * Usa: nome_noivos, data_evento, hora_evento / horario_evento, endereco_evento / endereco_residencial
 */
function EventSummary({ cliente }) {
  if (!cliente) {
    return (
      <p>
        Assim que a equipe Lorentz cadastrar os dados do seu evento, você verá
        aqui a data, horário e endereço completos.
      </p>
    );
  }

  const nomeNoivos =
    cliente.nome_noivos || cliente.nome_contratante || "seu evento";

  const dataEventoStr = cliente.data_evento; // "2026-01-01"
  const horaEventoStr = cliente.hora_evento || cliente.horario_evento || "";
  const endereco =
    cliente.endereco_evento ||
    cliente.endereco_residencial ||
    "endereço ainda não informado";

  const isCasamento = nomeNoivos.includes("&");

  const saudacao = isCasamento
    ? `Olá ${nomeNoivos}, o casamento de vocês está próximo.`
    : `Olá ${nomeNoivos}, seu evento está próximo.`;

  let textoPrincipal = "";
  if (!dataEventoStr) {
    textoPrincipal =
      "Assim que a data for definida, você verá aqui o prazo, horário e endereço do seu evento.";
  } else {
    const hoje = new Date();
    const hojeDia = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate()
    );

    const eventoDia = new Date(dataEventoStr + "T00:00:00");

    const diffMs = eventoDia.getTime() - hojeDia.getTime();
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const dataFormatada = eventoDia.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const horaFormatada = horaEventoStr
      ? horaEventoStr.toString().slice(0, 5)
      : "";

    const textoEvento = isCasamento ? "o casamento de vocês" : "o seu evento";

    if (diffDias > 1) {
      textoPrincipal = `Faltam ${diffDias} dias e estamos ansiosos para realizar ${textoEvento} na data programada para ${dataFormatada}${
        horaFormatada ? ` às ${horaFormatada}` : ""
      } em ${endereco}.`;
    } else if (diffDias === 1) {
      textoPrincipal = `Falta 1 dia e estamos ansiosos para realizar ${textoEvento} na data programada para ${dataFormatada}${
        horaFormatada ? ` às ${horaFormatada}` : ""
      } em ${endereco}.`;
    } else if (diffDias === 0) {
      textoPrincipal = `Hoje é o grande dia! Estamos prontos para realizar ${textoEvento} em ${dataFormatada}${
        horaFormatada ? ` às ${horaFormatada}` : ""
      } em ${endereco}.`;
    } else {
      textoPrincipal = `Seu evento aconteceu em ${dataFormatada}${
        horaFormatada ? ` às ${horaFormatada}` : ""
      } em ${endereco}.`;
    }
  }

  return (
    <>
      <p style={{ marginBottom: "0.75rem" }}>{saudacao}</p>
      <p>{textoPrincipal}</p>
    </>
  );
}

function ClientPage({ onOpenAdmin }) {
  const [user, setUser] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [role, setRole] = useState(null); // "admin" | "cliente" | null

  const [loginMsg, setLoginMsg] = useState("");
  const [loginType, setLoginType] = useState("info");
  const [loadingSessao, setLoadingSessao] = useState(true);

  // docs
  const [docsLoading, setDocsLoading] = useState(false);
  const [orcamentoUrl, setOrcamentoUrl] = useState(null);
  const [contratoUrl, setContratoUrl] = useState(null);

  // parcelas
  const [parcelasLoading, setParcelasLoading] = useState(false);
  const [parcelas, setParcelas] = useState([]);

  // Checar sessão só quando abre a página de cliente
  useEffect(() => {
    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          setLoadingSessao(false);
          return;
        }
        const u = data.user;
        setUser(u);

        // carrega cliente + role
        await Promise.all([carregarPainel(u), carregarRoleUsuario(u)]);
      } catch (err) {
        console.error("[CLIENTE] erro ao checar sessão:", err);
      } finally {
        setLoadingSessao(false);
      }
    }
    checkSession();
  }, []);

  async function carregarRoleUsuario(userObj) {
    const r = await buscarRole(userObj.id);
    setRole(r);
  }

  async function carregarPainel(userObj) {
    const cli = await buscarCliente(userObj);
    setCliente(cli || null);

    if (!cli) {
      setOrcamentoUrl(null);
      setContratoUrl(null);
      setParcelas([]);
      return;
    }

    await Promise.all([carregarDocumentos(cli.id), carregarParcelas(cli.id)]);
  }

  async function carregarDocumentos(clienteId) {
    setDocsLoading(true);
    setOrcamentoUrl(null);
    setContratoUrl(null);

    try {
      const folder = String(clienteId);

      const { data, error } = await supabase.storage
        .from("documentos")
        .list(folder, {
          limit: 20,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        console.error("[CLIENTE] erro ao listar documentos:", error);
        return;
      }

      if (!data || !data.length) return;

      let orcFile = null;
      let ctrFile = null;

      data.forEach((file) => {
        const name = file.name.toLowerCase();
        if (!orcFile && name.includes("orcamento")) orcFile = file;
        if (!ctrFile && name.includes("contrato")) ctrFile = file;
      });

      if (orcFile) {
        setOrcamentoUrl(getDocumentoPublicUrl(`${folder}/${orcFile.name}`));
      }
      if (ctrFile) {
        setContratoUrl(getDocumentoPublicUrl(`${folder}/${ctrFile.name}`));
      }
    } catch (err) {
      console.error("[CLIENTE] erro inesperado ao carregar documentos:", err);
    } finally {
      setDocsLoading(false);
    }
  }

  async function carregarParcelas(clienteId) {
    setParcelasLoading(true);
    setParcelas([]);

    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("data_venc", { ascending: true });

      if (error) {
        console.error("[CLIENTE] erro ao carregar parcelas:", error);
        return;
      }
      setParcelas(data || []);
    } catch (err) {
      console.error("[CLIENTE] erro inesperado ao carregar parcelas:", err);
    } finally {
      setParcelasLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      setLoginMsg("Informe e-mail e senha para entrar.");
      setLoginType("error");
      return;
    }

    try {
      setLoginMsg("Entrando...");
      setLoginType("info");

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data?.user) {
        console.error("[CLIENTE] erro no login:", error);
        setLoginMsg("E-mail ou senha inválidos.");
        setLoginType("error");
        return;
      }

      const u = data.user;
      setUser(u);
      setLoginMsg("Login realizado com sucesso!");
      setLoginType("success");

      await Promise.all([carregarPainel(u), carregarRoleUsuario(u)]);
    } catch (err) {
      console.error("[CLIENTE] erro inesperado no login:", err);
      setLoginMsg("Erro inesperado ao tentar entrar. Tente novamente.");
      setLoginType("error");
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[CLIENTE] erro ao sair:", err);
    } finally {
      setUser(null);
      setCliente(null);
      setRole(null);
      setOrcamentoUrl(null);
      setContratoUrl(null);
      setParcelas([]);
      setLoginMsg("");
    }
  }

  const statusClass =
    loginType === "error"
      ? "status status-error"
      : loginType === "success"
      ? "status status-success"
      : "status";

  return (
    <>
      {/* Sem hero; página mais limpa para painel do cliente */}
      <main>
        <div
          className="content-grid"
          style={{ maxWidth: 900, gridTemplateColumns: "1fr" }}
        >
          <section className="card" id="client-card">
            <header className="card-header">
              <p className="section-kicker">Área do cliente</p>
              <h2>Seu evento com a Lorentz</h2>

              {/* Antes do login: instrução padrão */}
              {!user && (
                <p>
                  Faça login com o e-mail e a senha enviados pela equipe
                  Lorentz para visualizar orçamento, contrato, status dos
                  pagamentos e detalhes do seu evento.
                </p>
              )}

              {/* Depois de logado: resumo do evento usando os dados da tabela clientes */}
              {user && <EventSummary cliente={cliente} />}
            </header>

            {!user && (
              <>
                <form
                  onSubmit={handleLogin}
                  className="stack-form"
                  style={{ maxWidth: 420 }}
                >
                  <div className="form-row">
                    <label htmlFor="email">E-mail</label>
                    <input id="email" name="email" type="email" required />
                  </div>
                  <div className="form-row">
                    <label htmlFor="password">Senha</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                    />
                  </div>
                  <button type="submit" className="btn-primary full">
                    Entrar
                  </button>
                </form>

                {loginMsg && (
                  <p
                    className={statusClass}
                    style={{ marginTop: 8, fontSize: "0.8rem" }}
                  >
                    {loginMsg}
                  </p>
                )}

                {loadingSessao && (
                  <p className="hint" style={{ marginTop: 10 }}>
                    Verificando sessão atual...
                  </p>
                )}
              </>
            )}

            {user && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 4,
                    marginBottom: 10,
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    Conectado como <strong>{user.email}</strong>
                    {role === "admin" && (
                      <span style={{ marginLeft: 8, fontWeight: 500 }}>
                        • Acesso administrador
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleLogout}
                  >
                    Sair
                  </button>
                </div>

                {/* BLOCO ADM – só aparece para quem tiver role = 'admin' */}
                {role === "admin" && (
                  <section
                    className="card"
                    style={{
                      marginTop: 10,
                      border: "1px dashed rgba(0,0,0,0.1)",
                      background:
                        "linear-gradient(120deg, rgba(255,255,255,0.9), rgba(250,240,250,0.9))",
                    }}
                  >
                    <h3 className="subtitulo">Painel administrativo</h3>
                    <p className="hint" style={{ marginBottom: 8 }}>
                      Você está logado como administrador. Acesse o painel para
                      cadastrar novas decorações, ajustar dados dos clientes e
                      controlar as parcelas do evento.
                    </p>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => onOpenAdmin && onOpenAdmin()}
                    >
                      Acessar painel administrativo
                    </button>
                  </section>
                )}

                {!cliente && (
                  <p className="hint" style={{ marginTop: 10 }}>
                    Seus dados ainda não foram vinculados ao painel. Assim que a
                    equipe Lorentz cadastrar o seu evento, as informações
                    aparecerão aqui.
                  </p>
                )}

                {cliente && (
                  <>
                    {/* DOCUMENTOS */}
                    <section style={{ marginTop: 10, marginBottom: 16 }}>
                      <h3 className="subtitulo">Orçamento e contrato</h3>
                      {docsLoading && (
                        <p className="hint">
                          Carregando documentos do seu evento...
                        </p>
                      )}

                      {!docsLoading && !orcamentoUrl && !contratoUrl && (
                        <p className="hint">
                          Orçamento e contrato ainda não foram anexados em PDF.
                          A equipe Lorentz fará isso em breve.
                        </p>
                      )}

                      {!docsLoading && (orcamentoUrl || contratoUrl) && (
                        <ul
                          style={{
                            listStyle: "none",
                            paddingLeft: 0,
                            marginTop: 6,
                            fontSize: "0.9rem",
                          }}
                        >
                          {orcamentoUrl && (
                            <li style={{ marginBottom: 4 }}>
                              <a
                                href={orcamentoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-link"
                              >
                                Ver orçamento (PDF)
                              </a>
                            </li>
                          )}
                          {contratoUrl && (
                            <li>
                              <a
                                href={contratoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-link"
                              >
                                Ver contrato (PDF)
                              </a>
                            </li>
                          )}
                        </ul>
                      )}
                    </section>

                    {/* PARCELAS */}
                    <section>
                      <h3 className="subtitulo">Pagamentos</h3>
                      <p className="hint" style={{ marginBottom: 6 }}>
                        Acompanhe as parcelas combinadas com a equipe Lorentz.
                      </p>

                      {parcelasLoading && (
                        <p className="hint">Carregando parcelas...</p>
                      )}

                      {!parcelasLoading && parcelas.length === 0 && (
                        <p className="hint">
                          Ainda não há parcelas cadastradas para este evento.
                        </p>
                      )}

                      {!parcelasLoading && parcelas.length > 0 && (
                        <table className="tabela-pagamentos">
                          <thead>
                            <tr>
                              <th>Parcela</th>
                              <th>Vencimento</th>
                              <th>Valor</th>
                              <th>Tipo</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parcelas.map((p) => (
                              <tr key={p.id}>
                                <td>{p.numero ?? "-"}</td>
                                <td>{formatDate(p.data_venc)}</td>
                                <td>{formatCurrency(p.valor)}</td>
                                <td>{p.tipo || "-"}</td>
                                <td>{p.status || "aberta"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </section>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

export default ClientPage;
