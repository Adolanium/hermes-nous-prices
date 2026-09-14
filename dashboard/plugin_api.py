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
    return {"ok": True, "plugin": "nous-prices", "version": "0.1.1"}


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
        # Reuse Hermes' exact, cached model metadata for context windows. Do not
        # infer this from model IDs or pricing strings; missing metadata stays 0.
        try:
            from agent.models_dev import get_model_info
            for row in payload.get("providers", []):
                slug = str(row.get("slug") or "")
                lengths = {}
                for model in row.get("models") or []:
                    info = get_model_info(slug, model)
                    size = int(getattr(info, "context_window", 0) or 0) if info else 0
                    if size > 0:
                        lengths[model] = size
                row["context_lengths"] = lengths
        except Exception:
            for row in payload.get("providers", []):
                row["context_lengths"] = {}
        return _jsonable(payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"model catalog unavailable: {exc}") from exc


@router.get("/billing")
def billing(profile: Optional[str] = Query(None)) -> dict[str, Any]:
    """Return the parsed account state without exposing portal credentials."""
    try:
        from agent.billing_view import BillingState, build_billing_state
        from hermes_cli.anon_auth import guest_carries_inference
        from tui_gateway.billing_view import _serialize_billing_state
        with _profile_scope(profile):
            free_tier = guest_carries_inference()
            state = BillingState(logged_in=False) if free_tier else build_billing_state()
            return _jsonable(_serialize_billing_state(state, free_tier=free_tier))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"billing unavailable: {exc}") from exc


@router.get("/default-model")
def default_model(profile: Optional[str] = Query(None)) -> dict[str, Any]:
    try:
        from hermes_cli.inventory import load_picker_context
        with _profile_scope(profile):
            context = load_picker_context()
        return {"provider": context.current_provider, "model": context.current_model}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"default model unavailable: {exc}") from exc
