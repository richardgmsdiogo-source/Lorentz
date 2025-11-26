// src/CatalogPage.jsx
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const CATEGORIAS = ["todos", "Casamento", "Aniversário", "15 anos", "Infantil"];

// ===== Helpers de imagens (bucket decoracoes) =====
function getDecorPublicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from("decoracoes").getPublicUrl(path);
  return data?.publicUrl || null;
}

function getDecorFolder(decor) {
  if (decor.pasta_imagens) return String(decor.pasta_imagens).trim();
  if (decor.pasta) return String(decor.pasta).trim();
  if (decor.folder) return String(decor.folder).trim();
  if (decor.slug) return String(decor.slug).trim();
  return String(decor.id).trim(); // 10, 11, 12...
}

// ======== Regras antigas adaptadas para React ========

// Lista arquivos de imagem em um prefixo (pasta) do bucket decoracoes
async function listarImagensNoPrefixo(prefix) {
  const safePrefix = prefix || "";
  const { data, error } = await supabase.storage
    .from("decoracoes")
    .list(safePrefix, {
      limit: 50,
      sortBy: { column: "name", order: "asc" },
    });

  if (error || !data) {
    console.warn("[CATÁLOGO] Erro ao listar prefixo", safePrefix, error);
    return { arquivos: [], subpastas: [] };
  }

  // Supabase: pastas geralmente não têm metadata; arquivos têm metadata
  const arquivos = data.filter((item) =>
    /\.(jpg|jpeg|png|webp)$/i.test(item.name)
  );
  const subpastas = data.filter((item) => !item.metadata);

  return { arquivos, subpastas };
}

// Busca imagens na tabela decoracao_imagens (se existir)
async function buscarImagensDecoracaoDB(decoracaoId) {
  const urls = [];

  try {
    const { data, error } = await supabase
      .from("decoracao_imagens")
      .select("url, ordem")
      .eq("decoracao_id", decoracaoId)
      .order("ordem", { ascending: true });

    if (error) {
      console.warn("[CATÁLOGO] Erro em decoracao_imagens:", error.message);
      return urls;
    }

    (data || []).forEach((row) => {
      if (row.url) urls.push(row.url);
    });
  } catch (err) {
    console.warn(
      "[CATÁLOGO] decoracao_imagens não disponível ou erro inesperado:",
      err
    );
  }

  return urls;
}

// Busca imagens no Storage, usando pasta baseada na decoração
async function buscarImagensDecoracaoStorage(decor) {
  const urls = [];
  const pastaBase = getDecorFolder(decor);
  if (!pastaBase) return urls;

  try {
    // 1) Arquivos direto na pasta "10"
    const { arquivos, subpastas } = await listarImagensNoPrefixo(pastaBase);

    arquivos.forEach((f) => {
      const url = getDecorPublicUrl(`${pastaBase}/${f.name}`);
      if (url) urls.push(url);
    });

    // 2) Subpastas "10/10", "10/11", "10/12"...
    for (const folder of subpastas) {
      const subPrefix = `${pastaBase}/${folder.name}`;
      const { arquivos: arquivosSub } = await listarImagensNoPrefixo(
        subPrefix
      );

      arquivosSub.forEach((f) => {
        const url = getDecorPublicUrl(`${subPrefix}/${f.name}`);
        if (url) urls.push(url);
      });
    }
  } catch (err) {
    console.error(
      "[CATÁLOGO] Erro inesperado ao carregar imagens da decoração via Storage",
      decor.id,
      err
    );
  }

  return urls;
}

// Função principal para carregar imagens de UMA decoração
async function carregarImagensDecoracao(decor) {
  // 1) Tenta pela tabela decoracao_imagens
  let urls = await buscarImagensDecoracaoDB(decor.id);

  // 2) Se ainda não tem nada, tenta buscar no Storage
  if (!urls.length) {
    urls = await buscarImagensDecoracaoStorage(decor);
  }

  // 3) Fallback final: capa_url / imagem_url
  const capa = decor.capa_url || decor.imagem_url;
  if (!urls.length && capa) {
    urls.push(capa);
  }

  return urls;
}

// ======== Componente do Card ========
function DecorCard({ decor, onOpenModal }) {
  const [imagens, setImagens] = useState([]);
  const [loadingImgs, setLoadingImgs] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        setLoadingImgs(true);
        const urls = await carregarImagensDecoracao(decor);

        if (!cancelado) {
          setImagens(urls);
        }
      } catch (err) {
        console.error(
          "[CATÁLOGO] Erro ao carregar imagens da decoração",
          decor.id,
          err
        );
        if (!cancelado) {
          setImagens([]);
        }
      } finally {
        if (!cancelado) {
          setLoadingImgs(false);
        }
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [decor]);

  const capa = imagens[0] || null;

  const titulo = decor.titulo || decor.nome || "Decoração Lorentz";
  const categoria = decor.categoria || decor.tipo || "Decoração temática";
  const descricao = decor.descricao_curta || decor.descricao || "";

  return (
    <article className="decor-card">
      {capa ? (
        <img src={capa} alt={titulo} className="decor-img" />
      ) : (
        <div
          className="decor-img"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f2edf2",
            color: "var(--muted)",
            fontSize: "0.8rem",
          }}
        >
          {loadingImgs ? "Carregando foto..." : "Sem foto"}
        </div>
      )}

      <div className="decor-tag">{categoria}</div>
      <div className="decor-title">{titulo}</div>
      {descricao && <div className="decor-desc">{descricao}</div>}

      <button
        type="button"
        className="btn-secondary btn-small"
        onClick={() => onOpenModal(decor, imagens)}
        disabled={!imagens.length}
      >
        Ver fotos
      </button>
    </article>
  );
}

// ======== Página do Catálogo ========
function CatalogPage() {
  const [decoracoes, setDecoracoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState("todos");

  const [modalAberto, setModalAberto] = useState(false);
  const [modalDecor, setModalDecor] = useState(null);
  const [modalImagens, setModalImagens] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    async function carregarDecoracoes() {
      try {
        setLoading(true);
        setErro(null);

        const { data, error } = await supabase
          .from("decoracoes")
          .select("*")
          .order("id", { ascending: true });

        if (error) {
          console.error("[CATÁLOGO] erro ao buscar decoracoes:", error);
          setErro("Não foi possível carregar o catálogo.");
          setDecoracoes([]);
          return;
        }

        setDecoracoes(data || []);
      } catch (err) {
        console.error("[CATÁLOGO] erro inesperado:", err);
        setErro("Erro inesperado ao carregar o catálogo.");
        setDecoracoes([]);
      } finally {
        setLoading(false);
      }
    }

    carregarDecoracoes();
  }, []);

  const decoracoesFiltradas = decoracoes.filter((decor) => {
    if (categoriaAtiva === "todos") return true;
    const cat = (decor.categoria || decor.tipo || "").toLowerCase();
    return cat === categoriaAtiva.toLowerCase();
  });

  function abrirModal(decor, imagens) {
    if (!imagens || !imagens.length) return;
    setModalDecor(decor);
    setModalImagens(imagens);
    setCarouselIndex(0);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setModalDecor(null);
    setModalImagens([]);
    setCarouselIndex(0);
  }

  function irFotoAnterior() {
    if (!modalImagens.length) return;
    setCarouselIndex(
      (idx) => (idx - 1 + modalImagens.length) % modalImagens.length
    );
  }

  function irProximaFoto() {
    if (!modalImagens.length) return;
    setCarouselIndex((idx) => (idx + 1) % modalImagens.length);
  }

  return (
    <>
      {/* Hero só do catálogo */}
      <section id="hero">
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-kicker">✨Momentos que já ajudamos a tornar inesquecíveis.✨</p>
          <h1></h1>
          <p className="hero-subtitle">
Inspire-se com essas decorações e imagine como podemos deixar o seu evento com a sua cara.
          </p>
        </div>
      </section>

      <main>
        <div className="content-grid">
          <section className="card" id="catalogo-card">
            <header className="card-header">
              <p className="section-kicker">Portfólio</p>
              <p>
Conheça alguns dos nossos eventos e já comece a imaginar o seu com a gente.
<br />
Cada festa que fazemos carrega um pouquinho da história de quem confiou na Lorentz para transformar um sonho em decoração.
              </p>
            </header>

            <nav className="catalog-tabs" aria-label="Categorias de decoração">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={
                    "catalog-tab" + (categoriaAtiva === cat ? " active" : "")
                  }
                  onClick={() => setCategoriaAtiva(cat)}
                >
                  {cat === "todos" ? "Todas" : cat}
                </button>
              ))}
            </nav>

            {loading && (
              <p className="hint">Carregando cenários do Supabase...</p>
            )}
            {erro && <p className="hint status-error">{erro}</p>}

            {!loading && !erro && (
              <>
                {decoracoesFiltradas.length === 0 ? (
                  <p className="hint">
                    Nenhum cenário encontrado para esta categoria.
                  </p>
                ) : (
                  <div id="catalogo-grid">
                    {decoracoesFiltradas.map((decor) => (
                      <DecorCard
                        key={decor.id}
                        decor={decor}
                        onOpenModal={abrirModal}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            <p className="hint" style={{ marginTop: 14 }}>
Cuidamos de cada detalhe para que você cuide só de viver o momento. ✨
            </p>
          </section>
        </div>
      </main>

      {/* MODAL / CARROSSEL */}
      {modalAberto && modalDecor && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={fecharModal} />
          <div className="modal-dialog">
            <button
              className="modal-close"
              type="button"
              aria-label="Fechar"
              onClick={fecharModal}
            >
              &times;
            </button>

            <p className="section-kicker">
              {modalDecor.categoria || modalDecor.tipo || "Evento"}
            </p>
            <h3 className="modal-title">
              {modalDecor.titulo || modalDecor.nome || "Decoração Lorentz"}
            </h3>
            {modalDecor.descricao_curta && (
              <p className="modal-desc">{modalDecor.descricao_curta}</p>
            )}

            {modalImagens.length === 0 ? (
              <p className="hint">
                Ainda não há fotos cadastradas para este cenário.
              </p>
            ) : (
              <>
                <div className="carousel">
                  <button
                    type="button"
                    className="carousel-arrow"
                    onClick={irFotoAnterior}
                  >
                    &#10094;
                  </button>

                  <div className="carousel-viewport">
                    <img
                      className="carousel-image"
                      src={modalImagens[carouselIndex]}
                      alt={modalDecor.titulo || "Foto da decoração"}
                    />
                  </div>

                  <button
                    type="button"
                    className="carousel-arrow"
                    onClick={irProximaFoto}
                  >
                    &#10095;
                  </button>
                </div>

                <p className="carousel-indicator">
                  {carouselIndex + 1} / {modalImagens.length}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default CatalogPage;
