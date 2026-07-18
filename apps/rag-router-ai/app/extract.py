"""Extract plain text from an uploaded knowledge source.

PDFs go through pypdf; everything else (txt/md/csv) is decoded as UTF-8. The
caller passes the raw bytes plus the filename/mime so we can pick the path.
"""

from __future__ import annotations

import io


def _is_pdf(file_name: str | None, mime_type: str | None) -> bool:
    if mime_type and "pdf" in mime_type.lower():
        return True
    return bool(file_name and file_name.lower().endswith(".pdf"))


def extract_text(
    data: bytes, file_name: str | None = None, mime_type: str | None = None
) -> str:
    if _is_pdf(file_name, mime_type):
        return _extract_pdf(data)
    # txt / md / csv and other text formats.
    return data.decode("utf-8", errors="replace")


def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages).strip()
