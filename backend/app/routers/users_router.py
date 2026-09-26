from __future__ import annotations

from pydantic import BaseModel

from fastapi import APIRouter

from app.models import User
from app.storage import get_storage

router = APIRouter(prefix="/users", tags=["users"])


class CreateUserRequest(BaseModel):
    name: str
    role_id: str


@router.post("")
def create_user(req: CreateUserRequest):
    user = User(name=req.name, role_id=req.role_id)
    get_storage().users.insert(user.model_dump())
    return user.model_dump()


@router.get("")
def list_users():
    return get_storage().users.all()
