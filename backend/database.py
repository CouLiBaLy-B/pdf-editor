import os
from sqlalchemy import create_engine, Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime, timezone

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pdf_saas.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    credits = Column(Integer, default=0, nullable=False)
    is_admin = Column(Integer, default=0, nullable=False)  # 1 = admin
    stripe_customer_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    files = relationship("PDFFile", back_populates="owner", cascade="all, delete-orphan")
    share_links = relationship("ShareLink", back_populates="owner", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")


class PDFFile(Base):
    __tablename__ = "files"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    size_bytes = Column(Integer, default=0)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_accessed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    owner = relationship("User", back_populates="files")
    share_links = relationship("ShareLink", back_populates="file", cascade="all, delete-orphan")


class ShareLink(Base):
    __tablename__ = "share_links"
    id = Column(String, primary_key=True)
    file_id = Column(String, ForeignKey("files.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    owner = relationship("User", back_populates="share_links")
    file = relationship("PDFFile", back_populates="share_links")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    file_id = Column(String, nullable=True)
    type = Column(String, nullable=False)  # "topup" | "operation"
    credits_delta = Column(Integer, nullable=False)
    stripe_session_id = Column(String, nullable=True, unique=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user = relationship("User", back_populates="transactions")



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
