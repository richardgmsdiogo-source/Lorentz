// src/App.jsx
import { useState } from "react";
import CatalogPage from "./CatalogPage.jsx";
import ClientPage from "./ClientPage.jsx";
import "./styles.css";

function App() {
  const [page, setPage] = useState("catalogo"); // "catalogo" | "cliente"

  return (
    <>
      {/* Topbar comum */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img
              src="logo.png"
              alt="Lorentz Decorações"
              className="brand-logo-img"
            />
            <div className="brand-text">
              <span className="brand-name">
                Lorentz Decorações de Festas e Eventos BH e Região
              </span>
              <span className="brand-sub">
                <a
                  href="https://instagram.com/decoracoeslorentz"
                  target="_blank"
                  rel="noreferrer"
                >
                  @decoracoeslorentz
                </a>
              </span>
            </div>
          </div>

          <nav className="main-nav">
            <button
              type="button"
              className={
                "nav-link" + (page === "catalogo" ? " nav-active" : "")
              }
              onClick={() => setPage("catalogo")}
            >
              Catálogo
            </button>
            <button
              type="button"
              className={
                "nav-link" + (page === "cliente" ? " nav-active" : "")
              }
              onClick={() => setPage("cliente")}
            >
              Área do cliente
            </button>
          </nav>
        </div>
      </header>

      {/* PÁGINAS */}
      {page === "catalogo" ? <CatalogPage /> : <ClientPage />}

      {/* Rodapé comum */}
      <footer className="site-footer">
        <div className="footer-left">
          <span className="footer-madeby">
            Criado por{" "}
            <a
              href="https://www.instagram.com/richard.gms"
              target="_blank"
              rel="noreferrer"
            >
              @richard.gms
            </a>
          </span>
        </div>
      
        <div className="footer-right">
          <span className="footer-brand">
            Lorentz Decorações de Festas e Eventos BH e Região
          </span>
      
          {/* Instagram */}
          <a
            href="https://instagram.com/decoracoeslorentz"
            target="_blank"
            rel="noreferrer"
            className="footer-icon-link"
            aria-label="Instagram Lorentz Decorações"
          >
            <svg
              viewBox="0 0 24 24"
              className="footer-icon"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="5"
                ry="5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle
                cx="12"
                cy="12"
                r="4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
            </svg>
          </a>
      
          {/* WhatsApp */}
          <a
            href="https://wa.me/5531986841995?text=Ol%C3%A1%2C%20vim%20pelo%20site%20da%20Lorentz%20Decora%C3%A7%C3%B5es%20%F0%9F%8E%89"
            target="_blank"
            rel="noreferrer"
            className="footer-icon-link"
            aria-label="WhatsApp Lorentz Decorações"
          >
            <svg
              viewBox="0 0 24 24"
              className="footer-icon"
              aria-hidden="true"
            >
              <path
                d="M12 3.2A8.3 8.3 0 0 0 4 11.6a8.2 8.2 0 0 0 1.2 4.3L4 20.8l5-1.3a8.6 8.6 0 0 0 3 .5 8.3 8.3 0 0 0 8.2-8.4A8.3 8.3 0 0 0 12 3.2Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.6 9.2c-.2-.5-.3-.5-.7-.5h-.5c-.2 0-.5.1-.7.3a2.3 2.3 0 0 0-.7 1.7 4 4 0 0 0 .9 2.1 9 9 0 0 0 3.5 3 3.8 3.8 0 0 0 1.9.6 1.7 1.7 0 0 0 1.1-.5 1.4 1.4 0 0 0 .3-1 1.1 1.1 0 0 0-.3-.6l-.6-.3-1-.5c-.3-.1-.5-.1-.7.1l-.4.5c-.1.1-.3.1-.4.1a2.4 2.4 0 0 1-1.1-.6 4.3 4.3 0 0 1-1-1.3c-.1-.1 0-.3.1-.4l.3-.3c.1-.1.2-.3.2-.5a4.9 4.9 0 0 0-.3-.8Z"
                fill="currentColor"
              />
            </svg>
          </a>
        </div>
      </footer>

    </>
  );
}

export default App;
