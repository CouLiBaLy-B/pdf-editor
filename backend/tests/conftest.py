"""
Test configuration and fixtures for PDFPro backend tests.
"""
import pytest
import os
import tempfile
from pathlib import Path

# Set test environment variables before importing app modules
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-purposes-only-32chars"
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["REDIS_URL"] = ""  # Use memory storage


@pytest.fixture(scope="function")
def temp_dir():
    """Create a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture(scope="function")
def sample_pdf_bytes():
    """Generate minimal valid PDF bytes for testing."""
    return b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
196
%%EOF"""


@pytest.fixture(scope="function")
def invalid_pdf_bytes():
    """Generate invalid PDF-like bytes for testing validation."""
    return b"This is not a PDF file"


@pytest.fixture(scope="function")
def large_pdf_bytes():
    """Generate oversized PDF bytes (> 50MB simulated)."""
    # Simulate a large file by returning more than MAX_FILE_SIZE
    return b"%PDF-1.4" + b"x" * (51 * 1024 * 1024) + b"%%EOF"
