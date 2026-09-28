"""
Splits a whole book (parsed into pages/slides) into chapters, by looking
for a heading pattern near the top of each page — "Chapter 3",
"CHAPTER 3: Laws of Motion", "Unit II", and similar.

This is a heuristic, not a guarantee: it works well for textbooks that
mark chapter starts with a conventional heading (NCERT included), but a
book with an unusual layout may not split cleanly. When nothing matches
anywhere in the book, the whole thing is returned as a single chapter
rather than failing outright.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.ingestion.document_parser import ParsedUnit

# Matches a line like "Chapter 3", "CHAPTER 3.", "Chapter 3: Laws of Motion",
# "Unit II - Thermodynamics". Roman numerals are matched as plain letters
# (ivxlcdm) since a strict roman-numeral grammar isn't worth the complexity
# here — false positives on stray short words are unlikely in a heading line.
_HEADING_PATTERN = re.compile(
    r"^\s*(chapter|unit)\s+([0-9]+|[ivxlcdm]+)\b\.?\s*[:\-–—]?\s*(.*)$",
    re.IGNORECASE,
)

_MAX_LINES_CHECKED_PER_PAGE = 6
_MAX_TITLE_LINE_LENGTH = 80

# A table-of-contents line looks like "Chapter 1 .......... 12" — dots or
# spaces leading into a trailing page number. Without this check, the TOC
# page itself gets mistaken for the start of "Chapter 1".
_TOC_LEADER_PATTERN = re.compile(r"[.\s]{3,}\d+\s*$")


@dataclass
class DetectedChapter:
    title: str
    units: list[ParsedUnit]
    is_front_matter: bool = False


def _detect_heading(page_text: str) -> str | None:
    lines = [line.strip() for line in page_text.splitlines() if line.strip()]
    lines = lines[:_MAX_LINES_CHECKED_PER_PAGE]

    for i, line in enumerate(lines):
        match = _HEADING_PATTERN.match(line)
        if not match:
            continue

        number = match.group(2)
        rest = match.group(3).strip(" :-–—")

        if _TOC_LEADER_PATTERN.search(rest):
            continue  # looks like a table-of-contents entry, not a real chapter start

        # Many books put "CHAPTER 3" and the descriptive title on separate
        # lines rather than one — check the next line for a short, plain
        # line that looks like a title rather than body text.
        if not rest and i + 1 < len(lines):
            candidate = lines[i + 1]
            if len(candidate) <= _MAX_TITLE_LINE_LENGTH and not _HEADING_PATTERN.match(candidate):
                rest = candidate

        label = f"Chapter {number}"
        return f"{label}: {rest}" if rest else label

    return None


def split_into_chapters(units: list[ParsedUnit], fallback_title: str) -> list[DetectedChapter]:
    """
    Groups pages/slides into chapters by heading detection. Pages before
    the first detected heading (title page, table of contents, preface)
    are attached to the first real chapter rather than dropped or left as
    an oddly-named standalone chapter.
    """
    chapters: list[DetectedChapter] = []
    current_title: str | None = None
    current_units: list[ParsedUnit] = []

    def flush():
        if current_units:
            chapters.append(
                DetectedChapter(
                    title=current_title or fallback_title,
                    units=list(current_units),
                    is_front_matter=(current_title is None),
                )
            )

    for unit in units:
        heading = _detect_heading(unit.text)
        if heading:
            flush()
            current_title = heading
            current_units = [unit]
        else:
            current_units.append(unit)

    flush()

    if not chapters:
        return [DetectedChapter(title=fallback_title, units=units)]

    return chapters
