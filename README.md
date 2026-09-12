<div align="center">

<a href="https://github.com/NousResearch/hermes-agent">
  <img src="https://github.com/user-attachments/assets/ac2f5702-c842-4b2e-9340-737481fa0ece" width="96" height="96" alt="Hermes mark" />
</a>

# Nous Portal Pricing

**Compare models. Check prices. Choose your default.**

Browse Nous Portal prices inside Hermes Desktop, with sale discounts, free models, and your account balance. Saved prices stay available between visits.

<sub>FOR <a href="https://github.com/NousResearch/hermes-agent">HERMES DESKTOP</a> &nbsp;·&nbsp; COMMUNITY PLUGIN &nbsp;·&nbsp; VERSION 0.1.0</sub>

<br /><br />

[Explore the features](#-prices-at-a-glance) &nbsp;·&nbsp; [Install](#-install) &nbsp;·&nbsp; [Saved prices](#-prices-that-stay-loaded) &nbsp;·&nbsp; [Updates](#-updates-and-recovery)

<img width="1563" height="1006" alt="demo" src="https://github.com/user-attachments/assets/53580d75-693a-4f9c-89dd-828d2dd4eece" />


</div>

## 💳 Prices at a glance

Compare input and output costs in **USD per million tokens**, with cached-read pricing in the expanded model details when available.

| | |
| --- | --- |
| **Model pricing**<br />See free models, current prices, sale percentages, and original prices when the catalog supplies them. | **Search and filters**<br />Search by model ID or lab. Filter by Featured, Free, On sale, Reasoning, or Fast, then sort by price, name, or discount. |
| **Your account**<br />Check your plan, spendable balance, and remaining plan or top-up credit. Open the portal from the page. | **Your default model**<br />Expand a model to set it as the default for new chats on the active profile. The status bar shows that profile default's price. |

Labs have collapsible sections. Your category, lab, and sort choices are saved between visits. Use the **Free** filter to find models with no token charge; search matches names and IDs.

## 📦 Install

The unified package includes a Gateway API and a Desktop UI. Install it on the machine running the Gateway:

```sh
hermes plugins install Adolanium/hermes-nous-prices
hermes plugins enable nous-prices
```

Restart the Gateway to mount the API. On a machine running both Gateway and Desktop, Hermes' combined-package support discovers `desktop/plugin.js`. Restart Desktop or rescan plugins, then enable **Nous Pricing** in Capabilities > Plugins.

### Desktop with a remote Gateway

Install and enable the package on the remote Gateway as above. Install the package on the Desktop machine too, or copy the root `plugin.js` into the local Desktop plugin folder shown below. Installing files on the remote machine does not copy the UI to your local computer. Each machine keeps its own installation and updates.

The UI uses the selected Gateway's plugin API when available. If the companion is absent, it falls back to the existing `model.options` and `billing.state` Gateway methods. Older Desktop versions without `ctx.rest` use these methods directly. Authentication failures and server errors remain visible.

### Standalone Desktop installation

Copy the root `plugin.js` into the local folder:

| Platform | Plugin folder |
| --- | --- |
| Windows | `%LOCALAPPDATA%\hermes\desktop-plugins\hermes-nous-prices\` |
| macOS / Linux | `~/.hermes/desktop-plugins/hermes-nous-prices/` |

If you set a custom `HERMES_HOME`, use `$HERMES_HOME/desktop-plugins/hermes-nous-prices/` instead. Restart Desktop and enable the plugin. This single-file installation supports signed updates and works without installing the Gateway companion.

Keep one Desktop installation. Before switching from a manual install to a unified package, back up and move the manual folder outside `desktop-plugins`; Hermes does not overwrite manual installs. Keep the plugin's saved settings. The Desktop plugin ID remains `nous-prices`.

Connect your Nous Portal account in Hermes Settings to load account information. Open **Nous Pricing** from the sidebar, use **Nous Portal Pricing: open model pricing** in the command palette, or press **Ctrl+Alt+P** on Windows/Linux and **Cmd+Alt+P** on macOS.

## 💾 Prices that stay loaded

Successful price reads are saved locally for each profile. Reopening the page or restarting Hermes shows the saved prices while a fresh request runs.

- The catalog refreshes every **five minutes** while observed by the page or status bar.
- A pending catalog gets up to **twelve faster retries**, with capped backoff shared by both views.
- The account balance refreshes every **thirty seconds** while the page is open.
- Pending responses do not erase saved prices. Failed background reads preserve the last loaded data and show a notice.
- Saved prices show a timestamp. Model changes wait for live availability checks.
- **Refresh prices** requests a fresh catalog and restarts the retry budget.

Each successful price refresh replaces the saved snapshot. No daily task is needed.

Snapshots contain model IDs, prices, capabilities, and featured status. They do not store your balance, authentication, plan access, or default-model selection.

## 🔎 Where the numbers come from

```text
Nous Portal Pricing → Hermes gateway → catalog and account data
```

| Data | Hermes gateway method |
| --- | --- |
| Models, prices, discounts, capabilities, and plan availability | `model.options` |
| Account plan and balance | `billing.state` |
| Save a profile's default model | `profiles.configure` |

The Gateway companion uses Hermes' shared model inventory and billing serializer. Standalone installs use the RPC methods above. It does not scrape the portal or ask for separate credentials.

A default-model change is reported as successful only after the backend confirms it was applied. When Hermes asks for confirmation, the prompt expires if you change profiles or gateways, leave the page, or choose another model.

## 🔄 Updates and recovery

For unified packages, run `hermes plugins update nous-prices`, restart the Gateway, and rescan Desktop plugins on each machine. Their update button shows these instructions so the UI and API stay together.

For standalone installs, click **Check for updates** at the bottom of the page. The plugin checks this repository's [latest release](https://github.com/Adolanium/hermes-nous-prices/releases/latest) and shows **Update now** when a newer signed version is available. **Later** dismisses the offer. It checks only when you ask and never installs without confirmation.

Public releases need no GitHub login or token. Your Hermes Desktop version must expose local plugin-file APIs. Update checks and downloads use GitHub directly; installation always targets the local Desktop plugin folder, even when the active gateway is remote.

Every update is verified against an embedded ECDSA P-256 public key. The signed release binds the repository, plugin ID, version, exact commit, file size, and SHA-256 hash. Unsigned releases, mismatched downloads, and automatic downgrades are rejected.

Before replacement, the downloaded `plugin.js` is staged and read back for verification. The previous file is backed up. If replacement fails, the updater attempts to restore it. **Restore previous version** checks the backup and asks for confirmation before restoring. Saved settings and price snapshots remain in plugin storage.

Updating or restoring can reload the plugin. If the page does not refresh, restart Hermes. If a crash interrupts replacement, close Hermes and restore the `update-<id>-backup-plugin.js` file in the plugin folder to `plugin.js`, then reopen Hermes.

### Publishing a version

Pushing a commit alone does not offer an update. Each release needs a stable `v<VERSION>` tag and a signed `hermes-desktop-update` block in its release notes. Only `plugin.js` is updated; the README is documentation.

The maintainer keeps the signing key outside this repository. The plugin includes only its public verification key. Releases must be signed for `Adolanium/hermes-nous-prices` and plugin ID `nous-prices`, using schema 2. Both the signed version and the version declared in `plugin.js` must match the release tag.

<br />

<div align="center">
  <strong>Nous Portal Pricing</strong><br />
  <sub>Your model catalog, inside Hermes.</sub>
</div>


## Catalog package

The `catalog/` directory packages this Desktop plugin for the Hermes plugin catalog,
using the [combined package layout](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk#one-package-both-sdks).
Catalog admission is pending. The repository does not imply approval or endorsement.

To install the package directly before catalog admission:

```sh
hermes plugins install Adolanium/hermes-nous-prices/catalog
```

Run `hermes plugins enable nous-prices` and restart the Gateway, then rescan Desktop
plugins and enable the Desktop component in Capabilities > Plugins. This package adds no Agent tools, hooks, or middleware.
It requires Hermes Desktop with combined-package support. On a remote backend,
the Desktop component must also be installed on the machine running the app.

The existing root `plugin.js` remains the standalone distribution. Keep one
installation per Desktop plugin. Before switching from a manual install, back up
and move its folder out of the Desktop plugin directory; Hermes intentionally
does not overwrite manual installations. Keep plugin settings when migrating.

After catalog admission, use `hermes plugins update nous-prices` and rescan
Desktop plugins to adopt a reviewed update. The packaged copy's update and restore
actions cannot replace its files from GitHub releases. Standalone signed updates
continue to use the existing root files.

The catalog entry is named `hermes-nous-prices`; the installed package and its API namespace are `nous-prices`. If you installed the earlier `0.0.1.post1` preview, back it up and uninstall `hermes-nous-prices` before installing this package so both names are not enabled together.

For development, edit root `plugin.js`, `dashboard/`, and `__init__.py`, then run
`python scripts/build_catalog.py`. Commit the generated `desktop/` and `catalog/`
files. CI checks both distributions and runs HTTP and Desktop transport tests.
Catalog packaging releases use `catalog-v0.1.0-1` and are not marked as the latest
standalone release.

Run the checks with:

```sh
python scripts/build_catalog.py --check
python -m pytest tests/test_api.py -q
node --test tests/test_transport.mjs
```

To test discovery, API mounting, billing serialization and legacy model configs
against a Hermes checkout, set `HERMES_SOURCE` to that checkout and run
`python -m pytest tests/test_hermes_integration.py -q` with its Python environment.
These tests use a temporary Hermes home and the offline billing fixture.

## Credits

The Gateway companion was contributed by [@rahlquist](https://github.com/rahlquist) in
[PR #1](https://github.com/Adolanium/hermes-nous-prices/pull/1). Thank you, @rahlquist.
