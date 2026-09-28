"""
Minimal JSON-file persistence layer.

This stands in for MongoDB Atlas (named in the original proposal) so the
three modules — RAG, vector store, competency engine — are fully runnable
and demoable without provisioning a database. Every method here maps
1:1 to a MongoDB collection operation, so swapping in `pymongo` later is a
mechanical change confined to this one file.
"""
from __future__ import annotations

import json
import os
import threading
from typing import Any

from app.config import get_settings

_lock = threading.Lock()


class JsonCollection:
    """A single JSON file behaving like a Mongo collection of dict records."""

    def __init__(self, path: str):
        self.path = path
        if not os.path.exists(self.path):
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump([], f)

    def _read(self) -> list[dict]:
        with open(self.path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write(self, records: list[dict]) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, default=str)

    def insert(self, record: dict) -> None:
        with _lock:
            records = self._read()
            records.append(record)
            self._write(records)

    def find(self, **filters: Any) -> list[dict]:
        records = self._read()
        return [r for r in records if all(r.get(k) == v for k, v in filters.items())]

    def find_one(self, **filters: Any) -> dict | None:
        results = self.find(**filters)
        return results[0] if results else None

    def all(self) -> list[dict]:
        return self._read()

    def upsert(self, key_field: str, record: dict) -> None:
        with _lock:
            records = self._read()
            for i, r in enumerate(records):
                if r.get(key_field) == record.get(key_field):
                    records[i] = record
                    self._write(records)
                    return
            records.append(record)
            self._write(records)


class Storage:
    def __init__(self):
        settings = get_settings()
        base = os.path.abspath(settings.data_dir)
        self.users = JsonCollection(os.path.join(base, "users.json"))
        self.documents = JsonCollection(os.path.join(base, "documents.json"))
        self.chapters = JsonCollection(os.path.join(base, "chapters.json"))
        self.chunks = JsonCollection(os.path.join(base, "chunks.json"))
        self.quizzes = JsonCollection(os.path.join(base, "quizzes.json"))
        self.attempts = JsonCollection(os.path.join(base, "attempts.json"))


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = Storage()
    return _storage
