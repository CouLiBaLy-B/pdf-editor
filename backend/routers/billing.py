import json
import logging
import os
import uuid
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import User, Transaction, get_db
from auth import get_current_user
from services.email import send_receipt_email, send_low_credits_email

logger = logging.getLogger("pdfpro")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Packs de crédits : {pack_id: (credits, price_cents, label)}
CREDIT_PACKS = {
    "starter": (20,  500,  "20 crédits — 5€"),
    "pro":     (44,  1000, "44 crédits — 10€"),
    "max":     (100, 2000, "100 crédits — 20€"),
}

router = APIRouter()


def _get_or_create_customer(user: User, db: Session) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(email=user.email, metadata={"user_id": user.id})
    user.stripe_customer_id = customer.id
    db.commit()
    return customer.id


class TopupRequest(BaseModel):
    pack: str  # "starter" | "pro" | "max"


@router.post("/topup")
def create_topup(body: TopupRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Le paiement n'est pas encore configuré")
    if body.pack not in CREDIT_PACKS:
        raise HTTPException(status_code=400, detail="Pack invalide")
    credits, price_cents, label = CREDIT_PACKS[body.pack]
    customer_id = _get_or_create_customer(user, db)
    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "eur",
                "unit_amount": price_cents,
                "product_data": {"name": f"PDFPro — {label}"},
            },
            "quantity": 1,
        }],
        metadata={"user_id": user.id, "credits": credits, "pack": body.pack},
        success_url=f"{FRONTEND_URL}/dashboard?topup=success",
        cancel_url=f"{FRONTEND_URL}/dashboard",
    )
    return {"url": session.url}


@router.get("/balance")
def get_balance(user: User = Depends(get_current_user)):
    return {"credits": user.credits}


@router.get("/history")
def get_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": t.id,
            "type": t.type,
            "credits_delta": t.credits_delta,
            "file_id": t.file_id,
            "created_at": t.created_at.isoformat(),
        }
        for t in txs
    ]


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook Stripe non configuré")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook invalide")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        meta = session.get("metadata", {})
        user_id = meta.get("user_id")
        pack = meta.get("pack", "")
        pack_config = CREDIT_PACKS.get(pack)
        session_id = session.get("id")
        already_processed = db.query(Transaction).filter(
            Transaction.stripe_session_id == session_id
        ).first()
        if already_processed:
            return {"received": True, "duplicate": True}
        if session.get("payment_status") != "paid" or not user_id or not pack_config:
            return {"received": True, "ignored": True}
        credits, price_cents, _ = pack_config
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.query(User).filter(User.id == user_id).update(
                {User.credits: User.credits + credits}, synchronize_session=False
            )
            tx = Transaction(
                id=str(uuid.uuid4()),
                user_id=user.id,
                type="topup",
                credits_delta=credits,
                stripe_session_id=session_id,
            )
            db.add(tx)
            db.commit()
            try:
                send_receipt_email(user.email, credits, price_cents / 100)
            except Exception:
                logger.exception(json.dumps({
                    "level": "error", "event": "receipt_email_failed", "stripe_session_id": session_id,
                }))

    return {"received": True}
