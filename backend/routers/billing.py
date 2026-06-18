import os
import uuid
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import User, Transaction, get_db
from auth import get_current_user
from services.email import send_receipt_email, send_low_credits_email

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
        credits = int(meta.get("credits", 0))
        pack = meta.get("pack", "")
        if user_id and credits:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.credits += credits
                tx = Transaction(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    type="topup",
                    credits_delta=credits,
                    stripe_session_id=session["id"],
                )
                db.add(tx)
                db.commit()
                _, price_cents, _ = CREDIT_PACKS.get(pack, (0, 0, ""))
                send_receipt_email(user.email, credits, price_cents / 100)

    return {"received": True}
