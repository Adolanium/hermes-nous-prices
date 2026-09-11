"""Gateway-side API for the Nous Portal Pricing desktop companion.

The Desktop UI calls this namespace through ``ctx.rest``. Keeping the portal
calls in the gateway means the UI works against a remote Gateway as well as a
local one, without copying credentials into the Desktop process.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


def _profile_scope(profile: Optional[str]):
    """Return Hermes' profile context manager, when one is requested."""
    if not profile:
        from contextlib import nullcontext
        return nullcontext()
    from hermes_cli.web_server_profiles import _config_profile_scope
    return _config_profile_scope(profile)


@router.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "plugin": "nous-prices", "version": "0.1.0"}


@router.get("/catalog")
def catalog(
    profile: Optional[str] = Query(None),
    refresh: bool = False,
    include_unconfigured: bool = True,
) -> dict[str, Any]:
    """Return the same model-options payload used by Hermes' model picker."""
    try:
        from hermes_cli.inventory import build_model_options_payload, load_picker_context
        with _profile_scope(profile):
            payload = build_model_options_payload(
                load_picker_context(),
                include_unconfigured=bool(include_unconfigured),
                refresh=bool(refresh),
            )
        return _jsonable(payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"model catalog unavailable: {exc}") from exc


@router.get("/billing")
def billing() -> dict[str, Any]:
    """Return the parsed account state without exposing portal credentials."""
    try:
        from agent.billing_view import build_billing_state
        state = build_billing_state()
        return _jsonable({
            "logged_in": state.logged_in,
            "org_id": state.org_id,
            "org_slug": state.org_slug,
            "org_name": state.org_name,
            "role": state.role,
            "balance_usd": state.balance_usd,
            "portal_url": state.portal_url,
            "error": state.error,
        })
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"billing unavailable: {exc}") from exc


@router.get("/default-model")
def default_model(profile: Optional[str] = Query(None)) -> dict[str, Any]:
    try:
        from hermes_cli.config import load_config
        with _profile_scope(profile):
            cfg = load_config() or {}
        raw_model = cfg.get("model")
        model = raw_model if isinstance(raw_model, dict) else {}
        return {"provider": str(model.get("provider") or ""), "model": str(model.get("default") or "")}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"default model unavailable: {exc}") from exc
