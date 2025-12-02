// src/AdminPage.jsx
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Tabs do painel
const TABS = [
  { id: "decoracoes", label: "Decorações" },
  { id: "clientes", label: "Clientes" },
  { id: "parcelas", label: "Parcelas" },
  { id: "gestao", label: "Gestão" },
];

// Helpers de formatação
function formatDateBR(dateStr) {
  if (!dateStr) return "-";
  const raw = dateStr.slice(0, 10);
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

function formatTimeHHMM(timeStr) {
  if (!timeStr) return "";
  const t = timeStr.toString();
  // aceita "HH:MM:SS" ou "HH:MM"
  return t.slice(0, 5);
}

function formatCurrency(valor) {
  if (valor == null || isNaN(valor)) return "-";
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function AdminPage({ onBackToClient }) {
  const [activeTab, setActiveTab] = useState("decoracoes");

  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState("info");

  // --- Decorações ---
  const [decoracoes, setDecoracoes] = useState([]);
  const [loadingDecor, setLoadingDecor] = useState(false);
  const [editingDecor, setEditingDecor] = useState(null);

  const emptyDecor = {
    titulo: "",
    categoria: "",
    descricao: "",
  };

  const [decorForm, setDecorForm] = useState(emptyDecor);
  const [uploadingFotos, setUploadingFotos] = useState(false);

  // --- Clientes ---
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState(null);

  // Documentos (orçamento / contrato)
  const [docsCliente, setDocsCliente] = useState({
    orcamento: null,
    contrato: null,
    orcamentoName: null,
    contratoName: null,
  });
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);


  // --- Parcelas ---
  const [parcelas, setParcelas] = useState([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);
  // --- Gestão / envio de e-mails ---
  const [sendingEmails, setSendingEmails] = useState(false);

  // --- Gestão / calendário de eventos ---
  const hoje = new Date();
  const [calYear, setCalYear] = useState(hoje.getFullYear());
  const [calMonth, setCalMonth] = useState(hoje.getMonth()); // 0–11
  const [eventosByDate, setEventosByDate] = useState({});
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(null);

  // --- Gestão / prévia de cobranças ---
  const [cobrancas, setCobrancas] = useState([]);
  const [loadingCobrancas, setLoadingCobrancas] = useState(false);

  // Carrega decorações ao abrir a aba
  useEffect(() => {
    if (activeTab === "decoracoes") {
      loadDecoracoes();
    }
  }, [activeTab]);

  // Sempre que estiver na aba parcelas + tiver cliente, recarrega
  useEffect(() => {
    if (activeTab === "parcelas" && clienteSelecionado) {
      loadParcelas(clienteSelecionado.id);
    }
  }, [activeTab, clienteSelecionado]);

  // Quando entrar na aba Gestão pela primeira vez, carrega eventos
  useEffect(() => {
    if (
      activeTab === "gestao" &&
      !loadingEventos &&
      Object.keys(eventosByDate).length === 0
    ) {
      loadEventosCalendario();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  function showStatus(msg, type = "info") {
    setStatusMsg(msg);
    setStatusType(type);
    if (msg) {
      setTimeout(() => setStatusMsg(""), 4000);
    }
  }

  // =======================
  // DECORAÇÕES
  // =======================
  async function loadDecoracoes() {
    setLoadingDecor(true);
    try {
      const { data, error } = await supabase
        .from("decoracoes")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;
      setDecoracoes(data || []);
    } catch (err) {
      console.error("[ADMIN] erro ao carregar decoracoes:", err);
      showStatus(
        "Erro ao carregar decorações: " + (err.message || ""),
        "error"
      );
    } finally {
      setLoadingDecor(false);
    }
  }

  function handleChangeDecorField(field, value) {
    setDecorForm((f) => ({ ...f, [field]: value }));
  }

  function handleEditDecor(decor) {
    setEditingDecor(decor);
    setDecorForm({
      titulo: decor.titulo || decor.nome || "",
      categoria: decor.categoria || decor.tipo || "",
      descricao: decor.descricao_curta || decor.descricao || "",
    });
  }

  function resetDecorForm() {
    setEditingDecor(null);
    setDecorForm(emptyDecor);
  }

  async function handleSubmitDecor(e) {
    e.preventDefault();

    const payload = {
      titulo: decorForm.titulo || null,
      categoria: decorForm.categoria || null,
      descricao: decorForm.descricao || null,
    };

    try {
      if (editingDecor) {
        const { data, error } = await supabase
          .from("decoracoes")
          .update(payload)
          .eq("id", editingDecor.id)
          .select()
          .maybeSingle();

        if (error) throw error;

        setDecoracoes((list) =>
          list.map((d) => (d.id === editingDecor.id ? data || d : d))
        );

        showStatus("Decoração atualizada com sucesso!", "success");
      } else {
        const { data, error } = await supabase
          .from("decoracoes")
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        setDecoracoes((list) => [...list, data]);
        showStatus("Decoração adicionada com sucesso!", "success");
      }

      resetDecorForm();
    } catch (err) {
      console.error("[ADMIN] erro ao salvar decoração:", err);
      showStatus(
        "Erro ao salvar decoração: " + (err.message || "ver console"),
        "error"
      );
    }
  }

  async function handleDeleteDecor(id) {
    if (!window.confirm("Tem certeza que deseja excluir esta decoração?"))
      return;

    try {
      const { error } = await supabase
        .from("decoracoes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setDecoracoes((list) => list.filter((d) => d.id !== id));
      showStatus("Decoração removida.", "success");
    } catch (err) {
      console.error("[ADMIN] erro ao excluir decoração:", err);
      showStatus(
        "Erro ao excluir decoração: " + (err.message || "ver console"),
        "error"
      );
    }
  }

  // Normaliza o nome do arquivo para algo seguro no Storage
  function makeSafeKeyName(original) {
    const parts = original.split(".");
    const ext = parts.length > 1 ? "." + parts.pop() : "";
    let base = parts.join(".");

    base = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    base = base.replace(/[^a-zA-Z0-9._-]/g, "-");

    if (!base) base = "arquivo";

    return base.toLowerCase() + ext.toLowerCase();
  }

  async function handleUploadFotos(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (!editingDecor || !editingDecor.id) {
      showStatus(
        "Salve a decoração e clique em 'Editar' antes de enviar as fotos.",
        "info"
      );
      e.target.value = "";
      return;
    }

    const folder = String(editingDecor.id).trim();

    try {
      setUploadingFotos(true);

      for (const file of files) {
        const safeName = makeSafeKeyName(file.name);
        const path = `${folder}/${safeName}`;

        const { error } = await supabase.storage
          .from("decoracoes")
          .upload(path, file, {
            upsert: true,
          });

        if (error) throw error;
      }

      showStatus(
        `Fotos enviadas para a pasta ${folder} no bucket "decoracoes".`,
        "success"
      );
    } catch (err) {
      console.error("[ADMIN] erro ao enviar fotos:", err);
      showStatus(
        "Erro ao enviar fotos: " + (err.message || "ver console"),
        "error"
      );
    } finally {
      setUploadingFotos(false);
      e.target.value = "";
    }
  }

  // =======================
  // CLIENTES
  // =======================
  async function buscarClientes() {
    if (!clienteBusca.trim()) {
      showStatus("Digite um nome ou e-mail para buscar clientes.", "info");
      return;
    }

    setLoadingClientes(true);
    setClientes([]);
    setClienteSelecionado(null);
    setParcelas([]);

    try {
      const termo = `%${clienteBusca.trim()}%`;

      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .or(`nome_contratante.ilike.${termo},email.ilike.${termo}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setClientes(data || []);
      if (!data || data.length === 0) {
        showStatus("Nenhum cliente encontrado.", "info");
      }
    } catch (err) {
      console.error("[ADMIN] erro ao buscar clientes:", err);
      showStatus(
        "Erro ao buscar clientes: " + (err.message || "ver console"),
        "error"
      );
    } finally {
      setLoadingClientes(false);
    }
  }

  function selecionarCliente(cli) {
    setClienteSelecionado(cli);
    if (activeTab === "parcelas") {
      loadParcelas(cli.id);
    }
    loadDocsCliente(cli.id); // <<< NOVO
  }


  async function salvarClienteAtualizado(campo, valor) {
    if (!clienteSelecionado) return;

    const novo = { ...clienteSelecionado, [campo]: valor };
    setClienteSelecionado(novo);
    setClientes((list) =>
      list.map((c) => (c.id === novo.id ? novo : c))
    );

    try {
      const { error } = await supabase
        .from("clientes")
        .update({ [campo]: valor })
        .eq("id", novo.id);

      if (error) throw error;
      showStatus("Cliente atualizado.", "success");
    } catch (err) {
      console.error("[ADMIN] erro ao atualizar cliente:", err);
      showStatus(
        "Erro ao atualizar cliente: " + (err.message || "ver console"),
        "error"
      );
    }
  }

  // Carrega orçamento/contrato do bucket "documentos/<cliente_id>/"
  async function loadDocsCliente(clienteId) {
    if (!clienteId) return;

    setLoadingDocs(true);
    setDocsCliente({
      orcamento: null,
      contrato: null,
      orcamentoName: null,
      contratoName: null,
    });

    try {
      const pasta = String(clienteId);

      const { data, error } = await supabase.storage
        .from("documentos")
        .list(pasta, { limit: 100, offset: 0 });

      if (error) throw error;

      let orcFile = null;
      let contFile = null;

      (data || []).forEach((item) => {
        if (!item.name) return;

        if (item.name.startsWith("orcamento")) {
          if (!orcFile || item.created_at > orcFile.created_at) {
            orcFile = item;
          }
        }
        if (item.name.startsWith("contrato")) {
          if (!contFile || item.created_at > contFile.created_at) {
            contFile = item;
          }
        }
      });

      const result = {
        orcamento: null,
        contrato: null,
        orcamentoName: null,
        contratoName: null,
      };

      if (orcFile) {
        const {
          data: { publicUrl },
        } = supabase.storage
          .from("documentos")
          .getPublicUrl(`${pasta}/${orcFile.name}`);
        result.orcamento = publicUrl;
        result.orcamentoName = orcFile.name;
      }

      if (contFile) {
        const {
          data: { publicUrl },
        } = supabase.storage
          .from("documentos")
          .getPublicUrl(`${pasta}/${contFile.name}`);
        result.contrato = publicUrl;
        result.contratoName = contFile.name;
      }

      setDocsCliente(result);
    } catch (err) {
      console.error("[ADMIN] erro ao carregar documentos do cliente:", err);
      showStatus(
        "Erro ao carregar documentos do cliente: " +
          (err.message || "ver console"),
        "error"
      );
    } finally {
      setLoadingDocs(false);
    }
  }


  // Upload de PDF de orçamento/contrato para documentos/<cliente_id>/
  async function uploadDocumento(tipo, file) {
    // tipo: "orcamento" ou "contrato"
    if (!clienteSelecionado) {
      showStatus("Selecione um cliente antes de enviar documentos.", "info");
      return;
    }
    if (!file) return;

    if (file.type !== "application/pdf") {
      showStatus("Envie apenas arquivos PDF.", "error");
      return;
    }

    const pasta = String(clienteSelecionado.id);
    const filename = `${tipo}-${Date.now()}.pdf`;
    const path = `${pasta}/${filename}`;

    try {
      setUploadingDoc(true);

      const { error } = await supabase.storage
        .from("documentos")
        .upload(path, file, {
          upsert: true,
          contentType: "application/pdf",
        });

      if (error) throw error;

      showStatus(
        `${tipo === "orcamento" ? "Orçamento" : "Contrato"} enviado com sucesso!`,
        "success"
      );

      // recarrega os links (pega sempre o mais recente)
      await loadDocsCliente(clienteSelecionado.id);
    } catch (err) {
      console.error("[ADMIN] erro ao enviar documento:", err);
      showStatus(
        "Erro ao enviar documento: " + (err.message || "ver console"),
        "error"
      );
    } finally {
      setUploadingDoc(false);
    }
  }

  const handleSelectDoc = (tipo) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadDocumento(tipo, file);
    // permite escolher o mesmo arquivo de novo depois
    e.target.value = "";
  };

  async function excluirDocumento(tipo) {
    // tipo: "orcamento" ou "contrato"
    if (!clienteSelecionado) {
      showStatus("Selecione um cliente antes de excluir documentos.", "info");
      return;
    }

    const label = tipo === "orcamento" ? "orçamento" : "contrato";
    const confirma = window.confirm(
      `Tem certeza que deseja excluir o(s) arquivo(s) de ${label} deste cliente?`
    );
    if (!confirma) return;

    const pasta = String(clienteSelecionado.id);

    try {
      setUploadingDoc(true);

      // Lista todos arquivos da pasta do cliente
      const { data, error } = await supabase.storage
        .from("documentos")
        .list(pasta, { limit: 100, offset: 0 });

      if (error) throw error;

      const pathsParaRemover = (data || [])
        .filter((item) => item.name && item.name.startsWith(tipo))
        .map((item) => `${pasta}/${item.name}`);

      if (pathsParaRemover.length === 0) {
        showStatus(`Nenhum ${label} encontrado para excluir.`, "info");
        return;
      }

      const { error: removeError } = await supabase.storage
        .from("documentos")
        .remove(pathsParaRemover);

      if (removeError) throw removeError;

      showStatus(
        `${label.charAt(0).toUpperCase() + label.slice(1)} excluído com sucesso.`,
        "success"
      );

      // Atualiza os links na tela
      await loadDocsCliente(clienteSelecionado.id);
    } catch (err) {
      console.error("[ADMIN] erro ao excluir documento:", err);
      showStatus(
        "Erro ao excluir documento: " + (err.message || "ver console"),
        "error"
      );
    } finally {
      setUploadingDoc(false);
    }
  }


  // =======================
  // PARCELAS
  // =======================
  async function loadParcelas(clienteId) {
    setLoadingParcelas(true);
    setParcelas([]);

    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("data_venc", { ascending: true });

      if (error) throw error;

      const hoje = new Date();
      const hojeDia = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate()
      );

      const idsParaVencido = [];

      const ajustadas = (data || []).map((p) => {
        // se não tem data ou já está pago, não mexe
        if (!p.data_venc || p.status === "pago") return p;

        const dv = new Date(p.data_venc);
        const dvDia = new Date(dv.getFullYear(), dv.getMonth(), dv.getDate());
        const diffMs = dvDia.getTime() - hojeDia.getTime();
        const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDias < 0 && p.status !== "vencido") {
          // já venceu e ainda está "aberta" → marcar para virar "vencido"
          idsParaVencido.push(p.id);
          return { ...p, status: "vencido" };
        }

        return p;
      });

      setParcelas(ajustadas);

      // Atualiza no Supabase quem precisava virar "vencido"
      if (idsParaVencido.length > 0) {
        const { error: errUpdate } = await supabase
          .from("parcelas")
          .update({ status: "vencido" })
          .in("id", idsParaVencido);

        if (errUpdate) throw errUpdate;
      }
    } catch (err) {
      console.error("[ADMIN] erro ao carregar parcelas:", err);
      showStatus(
        "Erro ao carregar parcelas: " + (err.message || "ver console"),
        "error"
      );
    } finally {
      setLoadingParcelas(false);
    }
  }


  async function salvarParcelaCampo(parcelaId, campo, valor) {
    const antiga = parcelas.find((p) => p.id === parcelaId);
    const atualizada = { ...antiga, [campo]: valor };

    setParcelas((list) =>
      list.map((p) => (p.id === parcelaId ? atualizada : p))
    );

    try {
      const { error } = await supabase
        .from("parcelas")
        .update({ [campo]: valor })
        .eq("id", parcelaId);

      if (error) throw error;
      showStatus("Parcela atualizada.", "success");
    } catch (err) {
      console.error("[ADMIN] erro ao atualizar parcela:", err);
      showStatus(
        "Erro ao atualizar parcela: " + (err.message || "ver console"),
        "error"
      );
    }
  }

  async function excluirParcela(parcelaId) {
    const parcela = parcelas.find((p) => p.id === parcelaId);
    const label = parcela ? `parcela #${parcela.numero}` : "esta parcela";

    if (!window.confirm(`Tem certeza que deseja excluir ${label}?`)) return;

    try {
      const { error } = await supabase
        .from("parcelas")
        .delete()
        .eq("id", parcelaId);

      if (error) throw error;

      setParcelas((list) => list.filter((p) => p.id !== parcelaId));
      showStatus("Parcela excluída com sucesso.", "success");
    } catch (err) {
      console.error("[ADMIN] erro ao excluir parcela:", err);
      showStatus(
        "Erro ao excluir parcela: " + (err.message || "ver console"),
        "error"
      );
    }
  }

  async function criarParcela() {
    if (!clienteSelecionado) {
      showStatus("Selecione um cliente antes de adicionar parcelas.", "info");
      return;
    }

    try {
      const payload = {
        cliente_id: clienteSelecionado.id,
        numero: (parcelas[parcelas.length - 1]?.numero || 0) + 1,
        valor: 0,
        data_venc: null,
        tipo: "pix",
        status: "aberta",
      };

      const { data, error } = await supabase
        .from("parcelas")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setParcelas((list) => [...list, data]);
      showStatus("Parcela adicionada.", "success");
    } catch (err) {
      console.error("[ADMIN] erro ao criar parcela:", err);
      showStatus(
        "Erro ao criar parcela: " + (err.message || "ver console"),
        "error"
      );
    }
  }

  // =======================
  // GESTÃO – CALENDÁRIO
  // =======================

  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  async function dispararEmailsParcelas() {
    setSendingEmails(true);
    try {
      const resp = await fetch(
        "https://tsdrlbkrkjaxzpdxtmoa.supabase.co/functions/v1/smooth-responder",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": "nQKEC9M3AH",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      let data = null;
      try {
        data = await resp.json();
      } catch {}

      if (!resp.ok) {
        console.error("Erro na Edge Function:", resp.status, data);
        const detalhe =
          (data && (data.error || data.message)) ||
          resp.statusText ||
          "sem detalhes";

        showStatus(
          `Erro ao enviar lembretes (HTTP ${resp.status}): ${detalhe}`,
          "error"
        );
        return;
      }

      const enviados = data?.enviados ?? 0;
      const pulados = data?.puladosSemEmail ?? 0;

      showStatus(
        `Envio concluído. E-mails enviados: ${enviados}. Clientes sem e-mail: ${pulados}.`,
        "success"
      );
    } catch (err) {
      console.error("Erro ao disparar emails:", err);
      showStatus(
        "Falha ao chamar a função de e-mails. Veja o console para detalhes.",
        "error"
      );
    } finally {
      setSendingEmails(false);
    }
  }

  async function loadEventosCalendario() {
    setLoadingEventos(true);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select(
          "id, nome_contratante, nome_noivos, data_evento, hora_evento, horario_evento, endereco_evento"
        )
        .not("data_evento", "is", null)
        .order("data_evento", { ascending: true });

      if (error) throw error;

      const map = {};
      (data || []).forEach((cli) => {
        if (!cli.data_evento) return;
        const key = cli.data_evento.slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(cli);
      });

      setEventosByDate(map);

      // se tiver hoje, seleciona; senão, primeiro dia com evento
      const todayKey = new Date().toISOString().slice(0, 10);
      if (map[todayKey]) {
        setSelectedDateKey(todayKey);
      } else {
        const keys = Object.keys(map);
        if (keys.length > 0) setSelectedDateKey(keys[0]);
      }
    } catch (err) {
      console.error("[ADMIN] erro ao carregar eventos:", err);
      showStatus(
        "Erro ao carregar eventos para o calendário: " +
          (err.message || "ver console"),
        "error"
      );
    } finally {
      setLoadingEventos(false);
    }
  }

  function changeMonth(delta) {
    let newMonth = calMonth + delta;
    let newYear = calYear;

    if (newMonth < 0) {
      newMonth = 11;
      newYear = calYear - 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear = calYear + 1;
    }

    setCalYear(newYear);
    setCalMonth(newMonth);
  }

  function handleClickCalendarDay(day) {
    if (!day) return;
    const monthStr = String(calMonth + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const key = `${calYear}-${monthStr}-${dayStr}`;
    setSelectedDateKey(key);
  }

  // =======================
  // GESTÃO – COBRANÇAS
  // =======================
  async function carregarCobrancasElegiveis() {
    setLoadingCobrancas(true);
    setCobrancas([]);

    try {
      const hoje = new Date();
      const hojeDia = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate()
      );

      // Busca todas as parcelas (RLS precisa permitir)
      const { data: parcelasData, error: errParcelas } = await supabase
        .from("parcelas")
        .select("id, numero, valor, data_venc, status, tipo, cliente_id");

      if (errParcelas) throw errParcelas;

      const porCliente = {};

      (parcelasData || []).forEach((p) => {
        if (!p.data_venc || !p.cliente_id) return;
        if (p.status !== "aberta" && p.status !== "vencido") return;
        if (p.tipo && p.tipo.toLowerCase() === "cartao") return;

        const dv = new Date(p.data_venc);
        const dvDia = new Date(dv.getFullYear(), dv.getMonth(), dv.getDate());
        const diffMs = dvDia.getTime() - hojeDia.getTime();
        const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

        let tipoAviso = null;
        if (p.status === "aberta" && diffDias >= 0 && diffDias <= 5) {
          tipoAviso = "a_vencer";
        } else if (p.status === "vencido" && diffDias < 0) {
          tipoAviso = "vencido";
        } else {
          return; // não entra na regra
        }

        if (!porCliente[p.cliente_id]) {
          porCliente[p.cliente_id] = {
            cliente_id: p.cliente_id,
            parcelas: [],
          };
        }
        porCliente[p.cliente_id].parcelas.push({
          ...p,
          diffDias,
          tipoAviso,
        });
      });

      const clienteIds = Object.keys(porCliente);
      if (clienteIds.length === 0) {
        showStatus("Nenhuma parcela elegível para cobrança.", "info");
        setCobrancas([]);
        return;
      }

      const { data: clientesData, error: errClientes } = await supabase
        .from("clientes")
        .select("id, nome_contratante, nome_noivos, email")
        .in("id", clienteIds);

      if (errClientes) throw errClientes;

      const mapClientes = {};
      (clientesData || []).forEach((c) => {
        mapClientes[c.id] = c;
      });

      const lista = Object.values(porCliente).map((entry) => {
        const cli = mapClientes[entry.cliente_id] || {};
        const nome =
          cli.nome_noivos || cli.nome_contratante || "Cliente sem nome";
        const email = cli.email || "(sem e-mail)";
        const total = entry.parcelas.reduce(
          (sum, p) => sum + (p.valor || 0),
          0
        );
        const temVencido = entry.parcelas.some(
          (p) => p.tipoAviso === "vencido"
        );
        const temAVencer = entry.parcelas.some(
          (p) => p.tipoAviso === "a_vencer"
        );
        let resumoStatus;
        if (temVencido && temAVencer) resumoStatus = "A vencer e vencido";
        else if (temVencido) resumoStatus = "Vencido";
        else resumoStatus = "A vencer";

        return {
          cliente_id: entry.cliente_id,
          nome,
          email,
          total,
          resumoStatus,
          parcelas: entry.parcelas,
        };
      });

      setCobrancas(lista);
    } catch (err) {
      console.error("[ADMIN] erro ao carregar cobranças:", err);
      showStatus(
        "Erro ao carregar prévia de cobranças: " +
          (err.message || "ver console"),
        "error"
      );
    } finally {
      setLoadingCobrancas(false);
    }
  }

  // =======================
  // RENDER – dados auxiliares
  // =======================
  const statusClass =
    statusType === "error"
      ? "status status-error"
      : statusType === "success"
      ? "status status-success"
      : "status status-info";

  const pastaFotos = editingDecor?.id
    ? String(editingDecor.id)
    : "(salve e entre em editar)";

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const weekdayShort = ["D", "S", "T", "Q", "Q", "S", "S"];

  const firstDayOfMonth = new Date(calYear, calMonth, 1);
  const startWeekday = firstDayOfMonth.getDay(); // 0=Dom
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const daysArray = [];
  for (let i = 0; i < startWeekday; i++) daysArray.push(null);
  for (let d = 1; d <= daysInMonth; d++) daysArray.push(d);
  while (daysArray.length % 7 !== 0) daysArray.push(null);

  const todayKey = new Date().toISOString().slice(0, 10);
  const eventosSelecionados =
    selectedDateKey && eventosByDate[selectedDateKey]
      ? eventosByDate[selectedDateKey]
      : [];

  return (
    <main>
      <div
        className="content-grid"
        style={{ maxWidth: 1100, gridTemplateColumns: "1fr" }}
      >
        <section className="card">
          <header className="card-header">
            <p className="section-kicker">Administração</p>
            <h2>Painel do administrador</h2>
            <p className="hint">
              Aqui você gerencia catálogo, clientes, parcelas e visão geral dos
              eventos do portal Lorentz.
            </p>

            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: 8 }}
              onClick={onBackToClient}
            >
              Voltar para área do cliente
            </button>
          </header>

          <nav className="catalog-tabs" aria-label="Seções administrativas">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={
                  "catalog-tab" + (activeTab === t.id ? " active" : "")
                }
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {statusMsg && (
            <p className={statusClass} style={{ marginBottom: 8 }}>
              {statusMsg}
            </p>
          )}

          {/* === DECORAÇÕES === */}
          {activeTab === "decoracoes" && (
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "1.3fr 1.7fr",
              }}
            >
              <form onSubmit={handleSubmitDecor} className="stack-form">
                <h3 className="subtitulo">
                  {editingDecor ? "Editar decoração" : "Nova decoração"}
                </h3>

                <div className="form-row">
                  <label>Título</label>
                  <input
                    type="text"
                    value={decorForm.titulo}
                    onChange={(e) =>
                      handleChangeDecorField("titulo", e.target.value)
                    }
                  />
                </div>

                <div className="form-row">
                  <label>Categoria (Casamento, Aniversário...)</label>
                  <input
                    type="text"
                    value={decorForm.categoria}
                    onChange={(e) =>
                      handleChangeDecorField("categoria", e.target.value)
                    }
                  />
                </div>

                <div className="form-row">
                  <label>Descrição</label>
                  <input
                    type="text"
                    value={decorForm.descricao}
                    onChange={(e) =>
                      handleChangeDecorField("descricao", e.target.value)
                    }
                  />
                </div>

                <div className="form-row">
                  <label>Pasta das fotos (somente leitura)</label>
                  <input type="text" value={pastaFotos} readOnly />
                  <p
                    className="hint"
                    style={{ marginTop: 4, fontSize: "0.75rem" }}
                  >
                    As fotos desta decoração serão lidas do bucket{" "}
                    <strong>decoracoes</strong>, pasta{" "}
                    <strong>{pastaFotos}</strong>.
                  </p>
                </div>

                {editingDecor ? (
                  <div className="form-row">
                    <label>Enviar fotos para esta decoração</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadFotos}
                    />
                    {uploadingFotos && (
                      <p className="hint" style={{ marginTop: 4 }}>
                        Enviando fotos, aguarde...
                      </p>
                    )}
                    {!uploadingFotos && (
                      <p className="hint" style={{ marginTop: 4 }}>
                        As imagens serão salvas em{" "}
                        <code>decoracoes/{pastaFotos}/arquivo.jpg</code>.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="hint" style={{ marginTop: 8 }}>
                    Para enviar fotos, primeiro salve a decoração e depois
                    clique em <strong>Editar</strong> na lista ao lado.
                  </p>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn-primary">
                    {editingDecor ? "Salvar alterações" : "Adicionar decoração"}
                  </button>
                  {editingDecor && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={resetDecorForm}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>

              <div>
                <h3 className="subtitulo">Decorações cadastradas</h3>

                {loadingDecor && (
                  <p className="hint">Carregando decorações...</p>
                )}

                {!loadingDecor && decoracoes.length === 0 && (
                  <p className="hint">
                    Nenhuma decoração cadastrada. Comece pelo formulário ao
                    lado.
                  </p>
                )}

                {!loadingDecor && decoracoes.length > 0 && (
                  <div style={{ maxHeight: 380, overflowY: "auto" }}>
                    <table className="tabela-pagamentos">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Título</th>
                          <th>Categoria</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {decoracoes.map((d) => (
                          <tr key={d.id}>
                            <td>{d.id}</td>
                            <td>{d.titulo || d.nome}</td>
                            <td>{d.categoria || d.tipo}</td>
                            <td>
                              <button
                                type="button"
                                className="btn-secondary btn-small"
                                onClick={() => handleEditDecor(d)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn-secondary btn-small"
                                style={{ marginLeft: 4 }}
                                onClick={() => handleDeleteDecor(d.id)}
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === CLIENTES === */}
          {activeTab === "clientes" && (
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "1.3fr 1.7fr",
              }}
            >
              <div>
                <h3 className="subtitulo">Buscar clientes</h3>

                <div className="form-row">
                  <label>Nome ou e-mail</label>
                  <input
                    type="text"
                    value={clienteBusca}
                    onChange={(e) => setClienteBusca(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: 8 }}
                  onClick={buscarClientes}
                >
                  Buscar
                </button>

                {loadingClientes && (
                  <p className="hint" style={{ marginTop: 8 }}>
                    Buscando clientes...
                  </p>
                )}

                {!loadingClientes && clientes.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      maxHeight: 280,
                      overflowY: "auto",
                    }}
                  >
                    <table className="tabela-pagamentos">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>E-mail</th>
                          <th>Data evento</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientes.map((c) => (
                          <tr key={c.id}>
                            <td className="nowrap-cell">
                              {c.nome_contratante}
                            </td>
                            <td className="nowrap-cell">{c.email}</td>
                            <td className="nowrap-cell">
                              {formatDateBR(c.data_evento)}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-secondary btn-small"
                                onClick={() => selecionarCliente(c)}
                              >
                                Selecionar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="subtitulo">Dados do cliente</h3>

                {!clienteSelecionado && (
                  <p className="hint">
                    Selecione um cliente na lista para visualizar e editar.
                  </p>
                )}

                {clienteSelecionado && (
                  <div className="stack-form">
                    {/* Dados principais */}
                    <div className="form-row">
                      <label>Nome do contratante</label>
                      <input
                        type="text"
                        value={clienteSelecionado.nome_contratante || ""}
                        onChange={(e) =>
                          salvarClienteAtualizado(
                            "nome_contratante",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="form-row">
                      <label>Nome dos noivos / aniversariante</label>
                      <input
                        type="text"
                        value={clienteSelecionado.nome_noivos || ""}
                        onChange={(e) =>
                          salvarClienteAtualizado(
                            "nome_noivos",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="form-row two-cols">
                      <div>
                        <label>CPF</label>
                        <input
                          type="text"
                          value={clienteSelecionado.cpf || ""}
                          onChange={(e) =>
                            salvarClienteAtualizado("cpf", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label>E-mail</label>
                        <input
                          type="email"
                          value={clienteSelecionado.email || ""}
                          onChange={(e) =>
                            salvarClienteAtualizado("email", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="form-row two-cols">
                      <div>
                        <label>Telefone</label>
                        <input
                          type="text"
                          value={clienteSelecionado.telefone || ""}
                          onChange={(e) =>
                            salvarClienteAtualizado(
                              "telefone",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <label>WhatsApp</label>
                        <input
                          type="text"
                          value={clienteSelecionado.telefone_whatsapp || ""}
                          onChange={(e) =>
                            salvarClienteAtualizado(
                              "telefone_whatsapp",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    </div>

                    {/* Evento */}
                    <div className="form-row two-cols">
                      <div>
                        <label>Data do evento</label>
                        <input
                          type="date"
                          value={
                            clienteSelecionado.data_evento
                              ? clienteSelecionado.data_evento.slice(0, 10)
                              : ""
                          }
                          onChange={(e) =>
                            salvarClienteAtualizado(
                              "data_evento",
                              e.target.value || null
                            )
                          }
                        />
                      </div>
                      <div>
                        <label>Hora do evento</label>
                        <input
                          type="time"
                          value={
                            clienteSelecionado.hora_evento
                              ? clienteSelecionado.hora_evento.slice(0, 5)
                              : ""
                          }
                          onChange={(e) =>
                            salvarClienteAtualizado(
                              "hora_evento",
                              e.target.value || null
                            )
                          }
                        />
                      </div>
                    </div>

                    {/* Documentos: Orçamento */}
                    <div className="form-row">
                      <label>Orçamento (PDF)</label>

                      {loadingDocs ? (
                        <p className="hint">Carregando documentos...</p>
                      ) : docsCliente.orcamento ? (
                        <p className="hint">
                          <a
                            href={docsCliente.orcamento}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir orçamento
                          </a>
                          {" "}
                          <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => excluirDocumento("orcamento")}
                            style={{ marginLeft: 4 }}
                          >
                            Excluir
                          </button>
                        </p>
                      ) : (
                        <p className="hint">Nenhum orçamento enviado ainda.</p>
                      )}

                      <input
                        type="file"
                        accept="application/pdf"
                        disabled={uploadingDoc}
                        onChange={handleSelectDoc("orcamento")}
                      />
                    </div>

                    {/* Documentos: Contrato */}
                    <div className="form-row">
                      <label>Contrato (PDF)</label>

                      {loadingDocs ? (
                        <p className="hint">Carregando documentos...</p>
                      ) : docsCliente.contrato ? (
                        <p className="hint">
                          <a
                            href={docsCliente.contrato}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir contrato
                          </a>
                          {" "}
                          <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => excluirDocumento("contrato")}
                            style={{ marginLeft: 4 }}
                          >
                            Excluir
                          </button>
                        </p>
                      ) : (
                        <p className="hint">Nenhum contrato enviado ainda.</p>
                      )}

                      <input
                        type="file"
                        accept="application/pdf"
                        disabled={uploadingDoc}
                        onChange={handleSelectDoc("contrato")}
                      />
                    </div>


                    <div className="form-row">
                      <label>Horário no convite / observações</label>
                      <input
                        type="text"
                        value={clienteSelecionado.horario_evento || ""}
                        onChange={(e) =>
                          salvarClienteAtualizado(
                            "horario_evento",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="form-row">
                      <label>Endereço residencial</label>
                      <input
                        type="text"
                        value={clienteSelecionado.endereco_residencial || ""}
                        onChange={(e) =>
                          salvarClienteAtualizado(
                            "endereco_residencial",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="form-row">
                      <label>Endereço do evento</label>
                      <input
                        type="text"
                        value={clienteSelecionado.endereco_evento || ""}
                        onChange={(e) =>
                          salvarClienteAtualizado(
                            "endereco_evento",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === PARCELAS === */}
          {activeTab === "parcelas" && (
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "1.1fr 1.9fr",
              }}
            >
              <div>
                <h3 className="subtitulo">Cliente</h3>

                {!clienteSelecionado && (
                  <p className="hint">
                    Use a aba <strong>Clientes</strong> para buscar e
                    selecionar o cliente. Depois volte aqui para gerenciar as
                    parcelas.
                  </p>
                )}

                {clienteSelecionado && (
                  <>
                    <p>
                      <strong>{clienteSelecionado.nome_contratante}</strong>
                    </p>
                    <p className="hint">{clienteSelecionado.email}</p>

                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ marginTop: 8 }}
                      onClick={() => loadParcelas(clienteSelecionado.id)}
                    >
                      Recarregar parcelas
                    </button>
                  </>
                )}
              </div>

              <div>
                <h3 className="subtitulo">Parcelas</h3>

                {!clienteSelecionado && (
                  <p className="hint">Nenhum cliente selecionado ainda.</p>
                )}

                {clienteSelecionado && (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={criarParcela}
                      >
                        Adicionar parcela
                      </button>
                    </div>

                    {loadingParcelas && (
                      <p className="hint">Carregando parcelas...</p>
                    )}

                    {!loadingParcelas && parcelas.length === 0 && (
                      <p className="hint">
                        Nenhuma parcela cadastrada para este cliente.
                      </p>
                    )}

                    {!loadingParcelas && parcelas.length > 0 && (
                      <div style={{ maxHeight: 340, overflowY: "auto" }}>
                        <table className="tabela-pagamentos">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Vencimento</th>
                              <th>Valor</th>
                              <th>Tipo</th>
                              <th>Status</th>
                              <th></th> {/* nova coluna para o botão */}
                            </tr>
                          </thead>
                          <tbody>
                            {parcelas.map((p) => (
                              <tr key={p.id}>
                                <td>{p.numero}</td>
                                <td>
                                  <input
                                    type="date"
                                    value={
                                      p.data_venc
                                        ? p.data_venc.slice(0, 10)
                                        : ""
                                    }
                                    onChange={(e) =>
                                      salvarParcelaCampo(
                                        p.id,
                                        "data_venc",
                                        e.target.value || null
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={p.valor ?? ""}
                                    onChange={(e) =>
                                      salvarParcelaCampo(
                                        p.id,
                                        "valor",
                                        e.target.value === ""
                                          ? null
                                          : Number(e.target.value)
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    value={p.tipo || ""}
                                    onChange={(e) =>
                                      salvarParcelaCampo(
                                        p.id,
                                        "tipo",
                                        e.target.value
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <select
                                    value={p.status || "aberta"}
                                    onChange={(e) =>
                                      salvarParcelaCampo(
                                        p.id,
                                        "status",
                                        e.target.value
                                      )
                                    }
                                  >
                                    <option value="aberta">A vencer</option>
                                    <option value="pago">Pago</option>
                                    <option value="vencido">Vencido</option>
                                  </select>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-small"
                                    onClick={() => excluirParcela(p.id)}
                                  >
                                    Excluir
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* === GESTÃO === */}
          {activeTab === "gestao" && (
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "1.3fr 1.7fr",
              }}
            >
              {/* Coluna esquerda: calendário */}
              <div>
                <h3 className="subtitulo">Agenda de eventos</h3>
                <p className="hint" style={{ marginBottom: 8 }}>
                  Veja rapidamente quais dias estão ocupados e clique no dia
                  para ver detalhes do evento.
                </p>

                <div className="calendar-card">
                  <div className="calendar-header">
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => changeMonth(-1)}
                    >
                      {"<"}
                    </button>
                    <span>
                      {monthNames[calMonth]} de {calYear}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => changeMonth(1)}
                    >
                      {">"}
                    </button>
                  </div>

                  <div className="calendar-grid">
                    {weekdayShort.map((w, idx) => (
                      <div key={idx} className="calendar-weekday">
                        {w}
                      </div>
                    ))}

                    {daysArray.map((day, idx) => {
                      if (!day) {
                        return (
                          <button
                            key={idx}
                            className="calendar-day empty"
                            disabled
                          />
                        );
                      }

                      const monthStr = String(calMonth + 1).padStart(2, "0");
                      const dayStr = String(day).padStart(2, "0");
                      const key = `${calYear}-${monthStr}-${dayStr}`;
                      const hasEvent = !!eventosByDate[key];
                      const isToday = key === todayKey;
                      const isSelected = key === selectedDateKey;

                      let className = "calendar-day";
                      if (hasEvent) className += " has-event";
                      if (isToday) className += " today";
                      if (isSelected) className += " selected";

                      return (
                        <button
                          key={idx}
                          type="button"
                          className={className}
                          onClick={() => handleClickCalendarDay(day)}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {loadingEventos && (
                  <p className="hint" style={{ marginTop: 8 }}>
                    Carregando eventos...
                  </p>
                )}
              </div>

              {/* Coluna direita: detalhes do dia + cobranças */}
              <div>
                <h3 className="subtitulo">Eventos no dia selecionado</h3>

                {!selectedDateKey && (
                  <p className="hint">
                    Clique em um dia marcado no calendário para ver os detalhes
                    do evento.
                  </p>
                )}

                {selectedDateKey && eventosSelecionados.length === 0 && (
                  <p className="hint">
                    Nenhum evento cadastrado em {formatDateBR(selectedDateKey)}.
                  </p>
                )}

                {selectedDateKey && eventosSelecionados.length > 0 && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: 8,
                      borderRadius: 12,
                      background: "var(--card2, #faf4f7)",
                    }}
                  >
                    <p className="hint" style={{ marginBottom: 4 }}>
                      {formatDateBR(selectedDateKey)} –{" "}
                      {eventosSelecionados.length} evento(s)
                    </p>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {eventosSelecionados.map((ev) => (
                        <li
                          key={ev.id}
                          style={{
                            padding: 8,
                            borderRadius: 10,
                            background: "#fff",
                            boxShadow:
                              "0 1px 3px rgba(15, 23, 42, 0.04)",
                          }}
                        >
                          <strong>
                            {ev.nome_noivos || ev.nome_contratante}
                          </strong>
                          <div style={{ fontSize: "0.8rem", marginTop: 2 }}>
                            {ev.hora_evento || ev.horario_evento ? (
                              <span>
                                Horário:{" "}
                                {formatTimeHHMM(
                                  ev.hora_evento || ev.horario_evento
                                )}
                                {" • "}
                              </span>
                            ) : null}
                            <span>
                              Local:{" "}
                              {ev.endereco_evento || "endereço não informado"}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <h3 className="subtitulo" style={{ marginTop: 8 }}>
                  Cobranças por e-mail
                </h3>
                <p className="hint" style={{ marginBottom: 8 }}>
                  Mostra os clientes que têm parcelas <strong>a vencer</strong>{" "}
                  (até 5 dias) ou <strong>vencidas</strong> e que entrariam no
                  disparo de e-mail. O envio real será feito pelo script
                  Python, usando os mesmos dados.
                </p>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={carregarCobrancasElegiveis}
                >
                  Carregar parcelas elegíveis
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={dispararEmailsParcelas}
                  style={{ marginLeft: 8 }}
                  disabled={sendingEmails}
                >
                  {sendingEmails ? "Enviando lembretes..." : "Enviar lembretes de parcelas"}
                </button>

                {loadingCobrancas && (
                  <p className="hint" style={{ marginTop: 8 }}>
                    Calculando cobranças elegíveis...
                  </p>
                )}

                {!loadingCobrancas && cobrancas.length === 0 && (
                  <p className="hint" style={{ marginTop: 8 }}>
                    Nenhum cliente selecionado para cobrança no momento.
                  </p>
                )}

                {!loadingCobrancas && cobrancas.length > 0 && (
                  <div style={{ marginTop: 10, maxHeight: 260, overflowY: "auto" }}>
                    <table className="tabela-pagamentos">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>E-mail</th>
                          <th>Qtd parcelas</th>
                          <th>Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobrancas.map((cob) => (
                          <tr key={cob.cliente_id}>
                            <td className="nowrap-cell">{cob.nome}</td>
                            <td className="nowrap-cell">{cob.email}</td>
                            <td>{cob.parcelas.length}</td>
                            <td>{formatCurrency(cob.total)}</td>
                            <td>{cob.resumoStatus}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="hint" style={{ marginTop: 8, fontSize: "0.75rem" }}>
                  Para disparar os e-mails de fato, use o script Python de
                  cobrança (abaixo) rodando em um servidor ou na sua máquina.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default AdminPage;
