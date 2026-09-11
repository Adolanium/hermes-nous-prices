<div align="center">

<a href="https://github.com/NousResearch/hermes-agent">
  <img src="https://github.com/user-attachments/assets/ac2f5702-c842-4b2e-9340-737481fa0ece" width="96" height="96" alt="Hermes mark" />
</a>

# Nous Portal Pricing

**Compare models. Check prices. Choose your default.**

Browse Nous Portal prices inside Hermes Desktop, with sale discounts, free models, and your account balance. Saved prices stay available between visits.

<sub>FOR <a href="https://github.com/NousResearch/hermes-agent">HERMES DESKTOP</a> &nbsp;·&nbsp; COMMUNITY PLUGIN &nbsp;·&nbsp; VERSION 0.0.1</sub>

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

The plugin is a unified Hermes package: a Gateway-side Python API plus a local Desktop UI. The Desktop UI talks to the selected Gateway through the plugin-scoped API, so it works when Desktop and Gateway run on different machines. There is no build step or extra server.

Install the repository as an agent plugin on the Gateway. The package's `desktop/plugin.js` is then installed into the local Desktop plugin directory by Hermes' unified-plugin flow:

```text
$HERMES_HOME/plugins/nous-prices/
├── plugin.yaml
├── dashboard/manifest.json
├── dashboard/plugin_api.py
└── desktop/plugin.js
```

The UI-only fallback location is:

```text
$HERMES_HOME/desktop-plugins/hermes-nous-prices/plugin.js
```

With the usual Hermes home location:

| Platform | Plugin folder |
| --- | --- |
| Windows | `%LOCALAPPDATA%\hermes\desktop-plugins\hermes-nous-prices\` |
| macOS / Linux | `~/.hermes/desktop-plugins/hermes-nous-prices/` |

If you set a custom `HERMES_HOME`, use that folder instead.

Restart Hermes after copying the file, then select **Nous Pricing** in the sidebar. Connect your Nous Portal account in Hermes Settings to load live account information.

You can also open the page through the command palette with **Nous Portal Pricing: open model pricing**, or press **Ctrl+Alt+P** on Windows/Linux and **Cmd+Alt+P** on macOS.

**Updating an existing installation?** Replace the installed `plugin.js`, then restart Hermes. Editing a separate development checkout does not update the installed copy.

Install this updater-enabled version manually once. Future signed releases can be installed from the page's update button.

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

The plugin uses the same catalog RPC as Hermes' model pickers. It does not scrape the portal or ask for separate credentials.

A default-model change is reported as successful only after the backend confirms it was applied. When Hermes asks for confirmation, the prompt expires if you change profiles or gateways, leave the page, or choose another model.

## 🔄 Updates and recovery

At the bottom of the page, click **Check for updates**. The plugin checks this repository's [latest release](https://github.com/Adolanium/hermes-nous-prices/releases/latest) and shows **Update now** when a newer signed version is available. **Later** dismisses the offer. It checks only when you ask and never installs without confirmation.

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
