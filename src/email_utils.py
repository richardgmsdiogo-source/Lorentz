"""
Módulo de envio de e-mails para o portal Lorentz.

Usa variáveis no .env:
  SMTP_HOST
  SMTP_PORT
  SMTP_USER
  SMTP_PASSWORD
  FROM_EMAIL  (opcional; se não tiver usa SMTP_USER)
"""

import os
import smtplib
import ssl
from email.message import EmailMessage

from dotenv import load_dotenv

# Carrega variáveis do .env (na mesma pasta do script)
load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL") or SMTP_USER


def _check_smtp_config():
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError(
            "Configuração SMTP incompleta. Verifique SMTP_HOST, SMTP_USER e SMTP_PASSWORD no .env"
        )


def send_email(to_email: str, subject: str, body: str):
    """
    Envia um e-mail de texto simples (UTF-8).

    Parameters
    ----------
    to_email : str
        E-mail de destino.
    subject : str
        Assunto.
    body : str
        Corpo em texto simples.
    """
    _check_smtp_config()

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg.set_content(body, subtype="plain", charset="utf-8")

    context = ssl.create_default_context()

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls(context=context)
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


def send_notification_email(to_email: str, nome_cliente: str, mensagem_base: str):
    """
    Envia um e-mail padrão de notificação para o cliente.

    - to_email: e-mail do cliente.
    - nome_cliente: nome que aparecerá na saudação.
    - mensagem_base: texto principal (parágrafos sobre parcelas, evento etc.).
    """
    subject = "Lorentz Decorações – Notificação"

    body = f"""Olá, {nome_cliente}.

{mensagem_base}

Qualquer dúvida, estamos à disposição.
Equipe Lorentz Decorações.
"""

    send_email(to_email, subject, body)
