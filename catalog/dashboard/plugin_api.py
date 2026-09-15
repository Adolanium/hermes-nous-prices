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
            for row in payload.get("providers", []):
                row["context_lengths"] = {}
                if str(row.get("slug") or "").lower() == "nous":
                    row["context_lengths"] = _nous_context_lengths(row.get("models") or [])
        return _jsonable(payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"model catalog unavailable: {exc}") from exc


def _nous_context_lengths(models: list[str]) -> dict[str, int]:
    """Read exact Portal IDs while the caller's profile scope is active."""
    if not models:
        return {}
    try:
        from hermes_cli.auth import (
            _resolve_verify, get_provider_auth_state, resolve_nous_runtime_credentials,
        )
        from hermes_cli.auth_nous import _nous_http_client

        credentials = resolve_nous_runtime_credentials(timeout_seconds=10)
        base_url = credentials["base_url"].rstrip("/")
        api_key = credentials["api_key"]
        if not base_url or not api_key:
            return {}
        verify = _resolve_verify(auth_state=get_provider_auth_state("nous"))
        with _nous_http_client(10, verify) as client:
            response = client.get(f"{base_url}/models", headers={"Authorization": f"Bearer {api_key}"})
            response.raise_for_status()
            rows = response.json().get("data", [])
        wanted = {model for model in models if isinstance(model, str)}
        lengths = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            model, size = row.get("id"), row.get("context_length")
            # Do not use the generic resolver: it also matches aliases and substrings.
            if isinstance(model, str) and model in wanted and type(size) is int and size > 0:
                lengths[model] = size
        return lengths
    except Exception:
        # Context metadata is optional; prices must remain available when it fails.
        return {}


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
