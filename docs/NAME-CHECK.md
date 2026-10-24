# Haven Name & Trademark Clearance Checklist (NAME-CHECK)
**Status:** Reconnaissance Checklist (Task D0)  
**Rule:** *Do not rename anything. This document lists all namespaces, package registries, domains, and trademark registries where the name "Haven" must be audited before general distribution.*

---

## 1. Domain Availability Audit

| Domain | Purpose | Status / Risk | Action Required |
|---|---|---|---|
| `haven.app` | Primary official web property | High demand gTLD; likely registered or premium reserved | Perform WHOIS / Registrar query |
| `haven.org` | Open-source foundation / project home | Historical domain; likely registered by non-profits or organizations | Perform WHOIS check |
| `haven.net` | Secondary network domain | Traditional TLD; likely registered | Perform WHOIS check |
| `haven.tools` | Developer & utility domain | Modern TLD; evaluate availability | Check Namecheap/Cloudflare registrar |
| `haven.io` | Tech & developer brand | High-value tech TLD; check registration | Perform WHOIS check |
| `haven-torrent.org` | Unambiguous open-source project domain | Highly likely available at standard non-premium pricing | Candidate for canonical download site |
| `havenclient.org` | Software client domain | Candidate alternative (similar to `transmissionbt.com`) | Candidate for canonical download site |
| `project-haven.org` | Umbrella project domain | Candidate alternative | Check availability |

---

## 2. Package Manager & Ecosystem Namespace Checks

### 2.1 Windows Package Manager (WinGet)
- **Registry**: `microsoft/winget-pkgs` (GitHub)
- **Search Command**: `winget search Haven`
- **Namespace Requirement**: WinGet uses `<Publisher>.<Package>` (e.g. `Haven.Haven` or `AbeeshSengottuvel.Haven`).
- **Risk Assessment**: "Haven" is a common English word. Several corporate utilities or games may use "Haven".
- **Action**: Verify whether `Haven.Haven` is claimed in the official WinGet manifest repository.

### 2.2 Flathub & Flatpak (Linux)
- **Registry**: Flathub Community Repository (`flathub.org`)
- **Namespace Standard**: Reverse-DNS identifier (e.g. `org.haven_app.Haven`, `org.cairn.haven`, or `io.github.AbeeshSengottuvel.Haven`).
- **Risk Assessment**: Check Flathub API and AppStream database for existing applications named "Haven".
- **Action**: Ensure chosen RDNS does not conflict with existing Flathub apps.

### 2.3 F-Droid & Google Play (Android)
- **CRITICAL KNOWN COLLISION**: 
  - **The Guardian Project** and Edward Snowden previously released an open-source Android physical security surveillance application named **"Haven: Keep Watch"** (Package ID: `org.havenapp.main`).
  - It has an active presence on F-Droid (`https://f-droid.org/packages/org.havenapp.main/`) and Google Play.
- **Risk**: High risk of brand confusion and repository rejection if submitting to F-Droid under the unqualified name "Haven" or `org.havenapp.*`.
- **Recommended Namespace for Haven Torrent**:
  - `org.haventorrent.client` or `org.cairn_haven.torrent` or `io.github.abeeshsengottuvel.haven`.

### 2.4 macOS & Homebrew Cask
- **Registry**: `Homebrew/homebrew-cask`
- **Formula Name**: `haven` (Check with `brew search haven`).
- **Risk Assessment**: If a brew cask named `haven` already exists, qualify as `haven-torrent`.

---

## 3. Trademark Registrations & Legal Databases

Before commercial marketing or broad distribution, searches must be conducted across primary intellectual property databases under **Nice Classification Class 009** (*Downloadable computer software; peer-to-peer software; computer programs for data transfer and communication*):

| Jurisdiction | Database / Office | Target Classes | Key Search Strings |
|---|---|---|---|
| **United States** | **USPTO TESS** (Trademark Electronic Search System) | Class 009, 042 | `"Haven"`, `"Haven Software"`, `"Haven Network"` |
| **European Union** | **EUIPO eSearch plus** | Class 009, 038, 042 | `"Haven"`, `"Haven Client"` |
| **United Kingdom** | **UK IPO** (Intellectual Property Office) | Class 009, 042 | `"Haven"` |
| **International** | **WIPO Madrid Monitor** | Class 009 | International trademark registrations under the Madrid Protocol |

### 3.1 Known Non-Torrent Software Marks
- **Haven Studios Inc.** (Sony Interactive Entertainment subsidiary - video games & entertainment software).
- **Haven Life** (Insurance software / fintech).
- **Haven Health** (Healthcare software).

*Note: In trademark law, mark conflicts depend on goods and services overlap. A dedicated, non-commercial BitTorrent client under an open-source license operating in a distinct channel may minimize confusion, but a clean TESS search is mandatory.*

---

## 4. Summary & Constraint
- **No changes to naming will be made during Phase D0.**
- The project continues development under the internal working name **Haven** (with Cairn as the backend library namespace `cairn-core`, `cairn-engine`, `cairn-safety`).
