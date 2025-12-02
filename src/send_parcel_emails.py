"""
Script de envio de e-mails de cobrança / lembrete de parcelas.

Lógica:
- Busca parcelas no Supabase:
    * status = "aberta" e vencimento entre hoje e hoje+5 dias (inclusive)
    * status = "vencido" e vencimento <= hoje
- Ignora parcelas do tipo "cartão" (qualquer variação de maiúsculas / acentos).
- Agrupa por cliente e envia 1 e-mail por cliente com todas as parcelas encontradas.

Pré-requisitos:
- Python 3.8+
- pip install supabase-py python-dotenv

Arquivos esperados na mesma pasta:
- .env        (com SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e config SMTP)
- email_utils.py
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from collections import defaultdict

from dotenv import load_dotenv
from supabase import create_client, Client

from email_utils import send_notification_email

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env"
    )

# Modo de teste: se True, NÃO envia e-mail de verdade, apenas printa no console.
DRY_RUN = False

# Dias até o vencimento para considerar "a vencer"
DIAS_AVISO = 5

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def create_supabase_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def parse_date(value):
    from datetime import date as _date

    if not value:
        return None
    # Supabase geralmente retorna 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:MM:SS'
    text = str(value)
    try:
        return _date.fromisoformat(text[:10])
    except Exception:
        return None


def format_brl(valor) -> str:
    try:
        v = float(valor or 0)
    except Exception:
        return "R$ 0,00"
    # Formata com separador BR (R$ 1.234,56)
    txt = f"{v:,.2f}"
    txt = txt.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {txt}"


def tipo_eh_cartao(tipo: str | None) -> bool:
    if not tipo:
        return False
    t = tipo.lower()
    # pega qualquer coisa tipo "cartao", "cartão", "credito cartao" etc
    return "cart" in t


# ---------------------------------------------------------------------------
# Consulta ao Supabase
# ---------------------------------------------------------------------------


def buscar_parcelas_relevantes(supabase: Client):
    hoje = date.today()
    limite = hoje + timedelta(days=DIAS_AVISO)

    # Abertas com vencimento entre hoje e hoje+DIAS_AVISO
    resp_abertas = (
        supabase.table("parcelas")
        .select("*")
        .eq("status", "aberta")
        .gte("data_venc", str(hoje))
        .lte("data_venc", str(limite))
        .execute()
    )
    if getattr(resp_abertas, "error", None):
        raise RuntimeError(f"Erro buscando parcelas abertas: {resp_abertas.error}")

    abertas = getattr(resp_abertas, "data", []) or []

    # Vencidas com data_venc <= hoje
    resp_vencidas = (
        supabase.table("parcelas")
        .select("*")
        .eq("status", "vencido")
        .lte("data_venc", str(hoje))
        .execute()
    )
    if getattr(resp_vencidas, "error", None):
        raise RuntimeError(f"Erro buscando parcelas vencidas: {resp_vencidas.error}")

    vencidas = getattr(resp_vencidas, "data", []) or []

    # Junta tudo e filtra cartão
    todas = abertas + vencidas
    filtradas = []
    for p in todas:
        if tipo_eh_cartao(p.get("tipo")):
            continue
        if not p.get("cliente_id"):
            continue
        filtradas.append(p)

    return filtradas


def buscar_clientes_por_ids(supabase: Client, ids):
    ids = list({i for i in ids if i})
    if not ids:
        return {}

    resp = (
        supabase.table("clientes")
        .select("*")
        .in_("id", ids)
        .execute()
    )
    if getattr(resp, "error", None):
        raise RuntimeError(f"Erro buscando clientes: {resp.error}")

    clientes = getattr(resp, "data", []) or []
    return {c["id"]: c for c in clientes}


# ---------------------------------------------------------------------------
# Montagem das mensagens
# ---------------------------------------------------------------------------


def montar_mensagem_cliente(cliente: dict, parcelas: list[dict]) -> str:
    hoje = date.today()

    linhas = []

    # Dados do evento (se existirem)
    data_evento = parse_date(cliente.get("data_evento"))
    hora_evento = cliente.get("hora_evento") or cliente.get("horario_evento")
    endereco_evento = (
        cliente.get("endereco_evento") or cliente.get("endereco_residencial")
    )

    if data_evento:
        data_evt_str = data_evento.strftime("%d/%m/%Y")
        if hora_evento:
            linhas.append(
                f"Evento previsto para {data_evt_str} às {str(hora_evento)[:5]}."
            )
        else:
            linhas.append(f"Evento previsto para {data_evt_str}.")
        if endereco_evento:
            linhas.append(f"Local: {endereco_evento}.")
        linhas.append("")  # linha em branco

    linhas.append("Identificamos as seguintes parcelas em aberto no seu contrato:")

    tem_abertas = False
    tem_vencidas = False

    for p in sorted(
        parcelas, key=lambda x: (x.get("data_venc") or "", x.get("numero") or 0)
    ):
        num = p.get("numero") or "-"
        tipo = p.get("tipo") or "-"
        status = p.get("status") or "aberta"
        data_v = parse_date(p.get("data_venc"))
        valor = p.get("valor")

        data_v_str = data_v.strftime("%d/%m/%Y") if data_v else "sem data"
        valor_str = format_brl(valor)

        if status == "aberta":
            tem_abertas = True
            dias = None
            if data_v:
                dias = (data_v - hoje).days
            if dias is not None and dias >= 0:
                desc = f"a vencer em {dias} dia(s)"
            else:
                desc = "a vencer"
        elif status == "vencido":
            tem_vencidas = True
            desc = "vencida"
        else:
            desc = status

        linhas.append(
            f"- Parcela {num} ({desc}) – vencimento {data_v_str} – {valor_str} – forma de pagamento: {tipo}"
        )

    linhas.append("")  # linha em branco final entre blocos

    if tem_abertas:
        linhas.append(
            f"As parcelas marcadas como 'a vencer' possuem vencimento em até {DIAS_AVISO} dia(s)."
        )
    if tem_vencidas:
        linhas.append(
            "As parcelas marcadas como 'vencida' constam em atraso em nosso controle interno."
        )

    linhas.append(
        "Se o pagamento de alguma dessas parcelas já foi realizado, por gentileza desconsidere este lembrete."
    )

    return "\n".join(linhas)


# ---------------------------------------------------------------------------
# Fluxo principal
# ---------------------------------------------------------------------------


def main():
    supabase = create_supabase_client()

    print("🔎 Buscando parcelas relevantes no Supabase...")
    parcelas = buscar_parcelas_relevantes(supabase)
    if not parcelas:
        print("✅ Nenhuma parcela a notificar no momento.")
        return

    # Agrupa por cliente_id
    by_cliente = defaultdict(list)
    for p in parcelas:
        by_cliente[p["cliente_id"]].append(p)

    cliente_ids = list(by_cliente.keys())
    print(f"📌 Encontradas {len(parcelas)} parcelas para {len(cliente_ids)} cliente(s).")

    clientes = buscar_clientes_por_ids(supabase, cliente_ids)

    total_enviados = 0

    for cliente_id, lista_parcelas in by_cliente.items():
        cliente = clientes.get(cliente_id)
        if not cliente:
            print(f"⚠️ Cliente {cliente_id} não encontrado; pulando.")
            continue

        email = cliente.get("email")
        if not email:
            print(f"⚠️ Cliente {cliente_id} sem e-mail cadastrado; pulando.")
            continue

        nome = (
            cliente.get("nome_noivos")
            or cliente.get("nome_contratante")
            or cliente.get("nome")
            or "cliente"
        )

        mensagem_base = montar_mensagem_cliente(cliente, lista_parcelas)

        print("=" * 60)
        print(f"Destinatário: {nome} <{email}>")
        print(mensagem_base)
        print("=" * 60)

        if DRY_RUN:
            print("🧪 DRY_RUN ativo – e-mail NÃO enviado de verdade.\n")
        else:
            try:
                send_notification_email(email, nome, mensagem_base)
                total_enviados += 1
                print("✅ E-mail enviado com sucesso.\n")
            except Exception as e:
                print(f"❌ Erro ao enviar e-mail para {email}: {e}\n")

    if DRY_RUN:
        print("DRY_RUN estava ativado. Nenhum e-mail real foi enviado.")
    else:
        print(f"✅ Processo concluído. E-mails enviados para {total_enviados} cliente(s).")


if __name__ == "__main__":
    main()
