import os
import resend

resend.api_key = os.getenv("RESEND_API_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
FROM_EMAIL = os.getenv("FROM_EMAIL", "PDFPro <noreply@pdfpro.app>")

_BASE_STYLE = "font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a"
_BTN_STYLE = "display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600"


def _send(to: str, subject: str, html: str):
    if not resend.api_key:
        return
    resend.Emails.send({"from": FROM_EMAIL, "to": [to], "subject": subject, "html": html})


def send_welcome_email(to_email: str):
    _send(to_email, "Bienvenue sur PDFPro 🎉", f"""
    <div style="{_BASE_STYLE}">
      <h2 style="color:#4f46e5">Bienvenue sur PDFPro !</h2>
      <p>Votre compte est prêt. Commencez par acheter des crédits pour éditer, signer et fusionner vos PDFs.</p>
      <p><a href="{FRONTEND_URL}/dashboard" style="{_BTN_STYLE}">Accéder à mon compte →</a></p>
      <p style="color:#888;font-size:12px">1 crédit = 1 opération = 0,25€</p>
    </div>""")


def send_reset_email(to_email: str, reset_token: str):
    _send(to_email, "Réinitialisation de votre mot de passe — PDFPro", f"""
    <div style="{_BASE_STYLE}">
      <h2>Réinitialisation du mot de passe</h2>
      <p>Cliquez sur le lien ci-dessous (valable 15 minutes) :</p>
      <p><a href="{FRONTEND_URL}/reset-password?token={reset_token}" style="{_BTN_STYLE}">Réinitialiser mon mot de passe</a></p>
      <p style="color:#888;font-size:12px">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    </div>""")


def send_receipt_email(to_email: str, credits_bought: int, amount_eur: float):
    _send(to_email, f"Reçu PDFPro — {credits_bought} crédits achetés", f"""
    <div style="{_BASE_STYLE}">
      <h2 style="color:#4f46e5">Paiement confirmé ✓</h2>
      <p>Merci pour votre achat !</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;border-bottom:1px solid #eee">Crédits achetés</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right"><strong>{credits_bought}</strong></td></tr>
        <tr><td style="padding:8px">Montant</td><td style="padding:8px;text-align:right"><strong>{amount_eur:.2f}€</strong></td></tr>
      </table>
      <p><a href="{FRONTEND_URL}/app" style="{_BTN_STYLE}">Utiliser mes crédits →</a></p>
    </div>""")


def send_low_credits_email(to_email: str, credits_remaining: int):
    _send(to_email, "⚠️ Il vous reste peu de crédits PDFPro", f"""
    <div style="{_BASE_STYLE}">
      <h2>Crédits faibles</h2>
      <p>Il ne vous reste que <strong>{credits_remaining} crédit(s)</strong>.</p>
      <p>Rechargez maintenant pour continuer à éditer vos PDFs sans interruption.</p>
      <p><a href="{FRONTEND_URL}/dashboard" style="{_BTN_STYLE}">Recharger mes crédits →</a></p>
    </div>""")
