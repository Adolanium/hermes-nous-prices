"""HTTP contract tests with isolated Hermes providers; no account or network access."""
from contextlib import contextmanager
from decimal import Decimal
import importlib.util
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(params=['dashboard/plugin_api.py', 'catalog/dashboard/plugin_api.py'])
def api(request, monkeypatch):
    state = SimpleNamespace(profile=None, guest=False, failure=None, calls=[],
                            metadata_calls=[], metadata_failure=None,
                            models=[{'id': 'work', 'context_length': 131072}])

    @contextmanager
    def scope(profile):
        if profile == 'missing':
            raise HTTPException(404, 'Profile not found')
        if profile == '../invalid':
            raise HTTPException(400, 'Invalid profile')
        state.profile = profile
        try:
            yield
        finally:
            state.profile = None

    def picker():
        if state.failure:
            raise state.failure
        return SimpleNamespace(current_provider='nous', current_model=state.profile or 'default')

    def catalog(context, **flags):
        state.calls.append((context.current_model, flags))
        return {'providers': [{'slug': 'nous', 'models': ['work'], 'pricing': {'input': Decimal('1.25')}}]}

    def billing():
        state.calls.append(('billing', state.profile))
        return SimpleNamespace(logged_in=True)

    def serialize(value, free_tier=False):
        return {'ok': True, 'logged_in': value.logged_in, 'free_tier': free_tier,
                'usage': {'available': value.logged_in, 'plan_name': 'Pro',
                          'total_spendable_display': '$12.50', 'renews_display': 'Tomorrow',
                          'plan_bar': {'remaining': Decimal('3.50')}, 'topup_bar': {'remaining': 9}}}

    def credentials(**kwargs):
        state.metadata_calls.append(('credentials', state.profile))
        return {'base_url': 'https://nous.example/v1', 'api_key': 'test-only-key'}

    class PortalClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def get(self, url, headers):
            state.metadata_calls.append((state.profile, url, headers))
            if state.metadata_failure:
                raise state.metadata_failure
            return SimpleNamespace(raise_for_status=lambda: None,
                                   json=lambda: {'data': state.models})

    modules = {
        'hermes_cli.auth': {'resolve_nous_runtime_credentials': credentials,
                            'get_provider_auth_state': lambda provider: {},
                            '_resolve_verify': lambda **kwargs: True},
        'hermes_cli.auth_nous': {'_nous_http_client': lambda *args: PortalClient()},
        'hermes_cli.inventory': {'load_picker_context': picker, 'build_model_options_payload': catalog},
        'hermes_cli.web_server_profiles': {'_config_profile_scope': scope},
        'hermes_cli.anon_auth': {'guest_carries_inference': lambda: state.guest},
        'agent.billing_view': {'BillingState': SimpleNamespace, 'build_billing_state': billing},
        'tui_gateway.billing_view': {'_serialize_billing_state': serialize},
    }
    for name, exports in modules.items():
        module = ModuleType(name)
        module.__dict__.update(exports)
        monkeypatch.setitem(sys.modules, name, module)
    spec = importlib.util.spec_from_file_location('nous_test_api', ROOT / request.param)
    module = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, spec.name, module)
    spec.loader.exec_module(module)
    app = FastAPI()
    app.include_router(module.router, prefix='/api/plugins/nous-prices')
    with TestClient(app) as client:
        yield client, state


def test_catalog_profile_flags_and_money(api):
    client, state = api
    response = client.get('/api/plugins/nous-prices/catalog?profile=work&refresh=true&include_unconfigured=false')
    assert response.status_code == 200
    assert response.json()['providers'][0]['pricing']['input'] == '1.25'
    assert response.json()['providers'][0]['context_lengths'] == {'work': 131072}
    assert state.calls == [('work', {'refresh': True, 'include_unconfigured': False})]
    assert state.profile is None


def test_context_metadata_uses_scoped_nous_credentials(api):
    client, state = api
    client.get('/api/plugins/nous-prices/catalog?profile=work')
    assert state.metadata_calls == [
        ('credentials', 'work'),
        ('work', 'https://nous.example/v1/models', {'Authorization': 'Bearer test-only-key'}),
    ]


@pytest.mark.parametrize('models', [
    [{'id': 'unrelated', 'context_length': 8192}],
    [{'id': 'work-extended', 'context_length': 8192}, {'id': 'other', 'context_length': 4096}],
    [{'id': 'vendor/work', 'context_length': 8192}],
    [{'id': 'work'}],
    [{'id': 'work', 'context_length': True}],
    [{'id': 'work', 'context_length': -1}],
    [{'id': 'work', 'context_length': '131072'}],
    [],
])
def test_missing_or_invalid_exact_context_stays_unknown(api, models):
    client, state = api
    state.models = models
    payload = client.get('/api/plugins/nous-prices/catalog').json()
    assert payload['providers'][0]['context_lengths'] == {}


def test_metadata_failure_preserves_prices(api):
    client, state = api
    state.metadata_failure = RuntimeError('offline')
    response = client.get('/api/plugins/nous-prices/catalog?profile=work')
    assert response.status_code == 200
    row = response.json()['providers'][0]
    assert row['pricing']['input'] == '1.25'
    assert row['context_lengths'] == {}
    assert state.profile is None


def test_billing_preserves_account_strip_contract(api):
    client, state = api
    response = client.get('/api/plugins/nous-prices/billing?profile=work')
    assert response.status_code == 200
    payload = response.json()
    assert payload['logged_in'] and not payload['free_tier']
    assert payload['usage'] == {'available': True, 'plan_name': 'Pro', 'total_spendable_display': '$12.50',
                               'renews_display': 'Tomorrow', 'plan_bar': {'remaining': '3.50'},
                               'topup_bar': {'remaining': 9}}
    assert state.calls == [('billing', 'work')]
    assert state.profile is None


def test_guest_does_not_load_account_billing(api):
    client, state = api
    state.guest = True
    payload = client.get('/api/plugins/nous-prices/billing').json()
    assert payload['free_tier'] and not payload['logged_in']
    assert not state.calls


@pytest.mark.parametrize('endpoint', ['catalog', 'billing', 'default-model'])
@pytest.mark.parametrize('profile,status', [('missing', 404), ('../invalid', 400)])
def test_profile_errors_keep_http_status(api, endpoint, profile, status):
    client, _ = api
    assert client.get(f'/api/plugins/nous-prices/{endpoint}', params={'profile': profile}).status_code == status


def test_default_model_uses_scoped_picker(api):
    client, state = api
    assert client.get('/api/plugins/nous-prices/default-model?profile=work').json() == {'provider': 'nous', 'model': 'work'}
    assert state.profile is None


def test_provider_failure_is_502_and_cleans_up_scope(api):
    client, state = api
    state.failure = RuntimeError('offline')
    assert client.get('/api/plugins/nous-prices/catalog?profile=work').status_code == 502
    assert state.profile is None
