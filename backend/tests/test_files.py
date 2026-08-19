"""
Tests for file upload validation and sanitization.
"""
import pytest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.files import sanitize_filename, validate_pdf_content


class TestSanitizeFilename:
    """Test filename sanitization."""

    def test_basic_filename(self):
        """Basic filename should pass through."""
        result = sanitize_filename("document.pdf")
        assert result == "document.pdf"

    def test_filename_with_path_traversal(self):
        """Path traversal attempts should be sanitized."""
        result = sanitize_filename("../../../etc/passwd")
        assert ".." not in result
        assert "/" not in result
        assert result.endswith(".pdf")

    def test_filename_with_special_chars(self):
        """Special characters should be replaced."""
        result = sanitize_filename('file<>:"/\\|?*.pdf')
        assert "<" not in result
        assert ">" not in result
        assert ":" not in result
        assert result.endswith(".pdf")

    def test_filename_with_null_bytes(self):
        """Null bytes should be removed."""
        result = sanitize_filename("file\x00.pdf")
        assert "\x00" not in result

    def test_empty_filename(self):
        """Empty filename should return a generated name."""
        result = sanitize_filename("")
        assert result.endswith(".pdf")
        assert len(result) > 0

    def test_only_extension(self):
        """Filename with only extension should get a generated name."""
        result = sanitize_filename(".pdf")
        assert result.endswith(".pdf")
        assert result != ".pdf"

    def test_filename_truncation(self):
        """Very long filenames should be truncated."""
        long_name = "a" * 300 + ".pdf"
        result = sanitize_filename(long_name)
        assert len(result) <= 255 + 4  # 255 chars + .pdf

    def test_uppercase_extension(self):
        """Uppercase extensions should work."""
        result = sanitize_filename("DOCUMENT.PDF")
        assert result.endswith(".pdf")
        assert "DOCUMENT" in result

    def test_no_extension(self):
        """Filename without .pdf extension should get one."""
        result = sanitize_filename("document")
        assert result.endswith(".pdf")

    def test_double_extension(self):
        """Double extensions should be handled."""
        result = sanitize_filename("document.pdf.txt")
        assert result.endswith(".pdf")
        assert ".txt" not in result


class TestValidatePdfContent:
    """Test PDF content validation."""

    def test_valid_pdf(self, sample_pdf_bytes):
        """Valid PDF should pass."""
        # Should not raise
        validate_pdf_content(sample_pdf_bytes)

    def test_invalid_magic_bytes(self, invalid_pdf_bytes):
        """Invalid PDF without magic bytes should raise."""
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            validate_pdf_content(invalid_pdf_bytes)
        assert "signature manquante" in str(exc_info.value.detail).lower()

    def test_missing_eof_marker(self):
        """PDF without EOF marker should raise."""
        from fastapi import HTTPException
        incomplete_pdf = b"%PDF-1.4 this is incomplete"
        with pytest.raises(HTTPException) as exc_info:
            validate_pdf_content(incomplete_pdf)
        assert "incomplet" in str(exc_info.value.detail).lower()

    def test_empty_content(self):
        """Empty content should raise."""
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            validate_pdf_content(b"")
