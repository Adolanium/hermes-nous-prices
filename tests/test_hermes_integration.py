"""Run against a Hermes checkout with HERMES_SOURCE and its Python environment.

All runtime state is temporary. Portal reads use Hermes' offline billing fixture.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys

import pytest

SOURCE = os.environ.get('HERMES_SOURCE')
if not SOURCE:
    pytest.skip('Set HERMES_SOURCE to run real Hermes integration tests', allow_module_level=True)
sys.path.insert(0, SOURCE)
ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def runtime(tmp_path, monkeypatch):
    monkeypatch.setenv('HERMES_HOME', str(tmp_path))
    monkeypatch.setenv('HERMES_DEV_BILLING_FIXTURE', 'card')
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from hermes_cli import web_server, web_server_dashboard, plugins_cmd, anon_auth
    monkeypatch.setattr(anon_auth, 'guest_carries_inference', lambda: False)
    app = FastAPI()
    monkeypatch.setattr(web_server, 'app', app)
    monkeypatch.setattr(web_server, '_get_dashboard_plugins', web_server_dashboard._discover_dashboard_plugins)
    monkeypatch.setattr(web_server_dashboard, '_dashboard_plugin_search_dirs', lambda: [(tmp_path / 'plugins', 'user')])
    monkeypatch.setattr(plugins_cmd, '_get_enabled_set', lambda: {'nous-prices'})
    monkeypatch.setattr(plugins_cmd, '_get_disabled_set', lambda: set())
    return tmp_path, app, TestClient, web_server_dashboard


@pytest.mark.parametrize('package', ['.', 'catalog'])
def test_real_discovery_mount_billing_and_default_model(runtime, monkeypatch, package):
    home, app, Client, dashboard = runtime
    target = home / 'plugins' / 'nous-prices'
    target.mkdir(parents=True)
    for file in ['plugin.yaml', '__init__.py']:
        shutil.copy2(ROOT / package / file, target / file)
    shutil.copytree(ROOT / package / 'dashboard', target / 'dashboard')
    from hermes_cli.plugins_manifest import parse_manifest_file
    from hermes_cli.plugins import PluginManager
    manifest = parse_manifest_file(target / 'plugin.yaml', target, 'user', '')
    assert manifest.name == 'nous-prices'
    manager = PluginManager(str(home))
    manager._load_plugin(manifest)
    loaded = next(p for p in manager.list_plugins() if p['name'] == 'nous-prices')
    assert loaded['enabled'] and not loaded['error']
    dashboard._mount_plugin_api_routes()
    from agent.billing_view import build_billing_state
    from tui_gateway.billing_view import _serialize_billing_state
    from hermes_cli import config
    with Client(app) as client:
        assert client.get('/api/plugins/nous-prices/health').status_code == 200
        response = client.get('/api/plugins/nous-prices/billing')
        assert response.status_code == 200, response.text
        assert response.json() == _serialize_billing_state(build_billing_state())
        assert response.json()['logged_in']
        assert 'usage' in response.json()
        for model, expected in [
            ('legacy/model', {'provider': '', 'model': 'legacy/model'}),
            ({'provider': 'nous', 'name': 'named/model'}, {'provider': 'nous', 'model': 'named/model'}),
            ({'provider': 'nous', 'default': 'default/model'}, {'provider': 'nous', 'model': 'default/model'}),
        ]:
            monkeypatch.setattr(config, 'load_config', lambda: {'model': model})
            assert client.get('/api/plugins/nous-prices/default-model').json() == expected
        assert client.get('/api/plugins/nous-prices/catalog?profile=../invalid').status_code == 400


def test_package_names_match_rest_namespace():
    import yaml
    for package in ['.', 'catalog']:
        manifest = yaml.safe_load((ROOT / package / 'plugin.yaml').read_text())
        dashboard = json.loads((ROOT / package / 'dashboard/manifest.json').read_text())
        assert manifest['name'] == dashboard['name'] == 'nous-prices'
        assert manifest['version'] == dashboard['version']
