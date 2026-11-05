"""Maintain derived wiki navigation; never compile sources or mark them processed."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import quote, unquote

BACKLINKS = re.compile(
    r"<!-- kb:backlinks:start -->.*?<!-- kb:backlinks:end -->", re.S
)


def markdown_hrefs(text: str) -> list[str]:
    """Read Markdown destinations, excluding examples inside code or comments."""
    lines, fence = [], None
    for line in text.splitlines(keepends=True):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if fence is not None:
            if (marker and marker[1][0] == fence[0]
                    and len(marker[1]) >= fence[1] and not marker[2].strip()):
                fence = None
            lines.append("\n" if line.endswith("\n") else "")
            continue
        if marker:
            fence = (marker[1][0], len(marker[1]))
            lines.append("\n" if line.endswith("\n") else "")
        else:
            lines.append(line)
    plain = re.sub(r"<!--.*?-->", "", "".join(lines), flags=re.S)
    plain = re.sub(r"(?<!\\)(`+)(?!`)(.*?)\1(?!`)", "", plain, flags=re.S)

    def destination(value: str) -> str | None:
        value = value.lstrip()
        if value.startswith("<"):
            end = value.find(">")
            return value[1:end] if end >= 0 else None
        depth, escaped, end = 0, False, 0
        for end, char in enumerate(value):
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == "(":
                depth += 1
            elif char == ")":
                if depth == 0:
                    break
                depth -= 1
            elif char.isspace() and depth == 0:
                break
        else:
            end = len(value)
        href = value[:end]
        return re.sub(r"\\([\\`*{}\[\]()#+.!_<> -])", r"\1", href) if href else None

    hrefs = []
    for match in re.finditer(r"(?<!\\)\[[^\]\n]*\]\(", plain):
        href = destination(plain[match.end():])
        if href is not None:
            hrefs.append(href)
    definitions = {}
    for match in re.finditer(r"^ {0,3}\[([^\]\n]+)\]:\s*(.+)$", plain, re.M):
        href = destination(match[2])
        if href is not None:
            definitions[" ".join(match[1].split()).casefold()] = href
    without_definitions = re.sub(r"^ {0,3}\[[^\]\n]+\]:.*$", "", plain, flags=re.M)
    for match in re.finditer(r"(?<!\\)\[([^\]\n]+)\](?:\[([^\]\n]*)\])?(?!\()",
                             without_definitions):
        reference = match[2] or match[1]
        href = definitions.get(" ".join(reference.split()).casefold())
        if href is not None:
            hrefs.append(href)
    return hrefs


def in_processed(root: Path, name: str) -> bool:
    return (root / name).resolve().is_relative_to((root / "raw/processed").resolve())


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def local_link(page: Path, href: str) -> Path | None:
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", href) or href.startswith(("#", "//")):
        return None
    return (page.parent / unquote(href.split("#")[0].strip("<>"))).resolve()


def title(path: Path) -> str:
    if not path.is_file():
        return path.stem
    text = path.read_text(encoding="utf-8")
    match = re.search(r"^# (.+)$", text, re.M)
    return match.group(1).strip() if match else path.stem


def cell(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def wiki_links(root: Path, pages: list[str]) -> str:
    return ", ".join(
        f"[{cell(title(root / name))}]({quote(Path(name).name)})" for name in pages
    ) or "None"


def source_state(root: Path, name: str, record: dict) -> str:
    path = root / name
    if not path.is_file():
        return "missing"
    actual = digest(path)
    if record.get("processed_sha256") == actual:
        return "processed"
    return "changed" if record.get("processed_sha256") else "pending"


def output_state(root: Path, name: str, record: dict) -> str:
    path = root / name
    if not path.is_file():
        return "missing"
    if record.get("reviewed_sha256") != digest(path):
        return "needs review"
    return record.get("status", "needs review")


def render_catalog(root: Path, memory: dict) -> str:
    names = set(memory["sources"]) | {
        p.relative_to(root).as_posix() for p in (root / "raw").rglob("*") if p.is_file()
    }
    rows = [
        "## Source catalog",
        "",
        "| Source | Current processing state | Summary and limits | Wiki pages |",
        "| --- | --- | --- | --- |",
    ]
    for name in sorted(names):
        record = memory["sources"].get(name, {})
        summary = record.get("summary", "Not summarized; wait for compilation.")
        rows.append(
            f"| [{cell(name)}](../{quote(name)})"
            f" | {source_state(root, name, record)} | {cell(summary)}"
            f" | {wiki_links(root, record.get('wiki_pages', []))} |"
        )
    return "\n".join(rows)


def render_outputs(root: Path, memory: dict) -> str:
    records = memory.get("outputs", {})
    names = set(records) | {
        p.relative_to(root).as_posix() for p in (root / "outputs").rglob("*.md")
    }
    rows = [
        "## Output review register",
        "",
        "| Saved report | Current review state | Durable contribution or reason | Wiki pages |",
        "| --- | --- | --- | --- |",
    ]
    for name in sorted(names):
        record = records.get(name, {})
        rows.append(
            f"| [{cell(Path(name).name)}](../{quote(name)})"
            f" | {output_state(root, name, record)}"
            f" | {cell(record.get('contribution', 'Review before filing an insight.'))}"
            f" | {wiki_links(root, record.get('wiki_pages', []))} |"
        )
    return "\n".join(rows)


def replace_block(text: str, key: str, body: str) -> str:
    start, end = f"<!-- kb:{key}:start -->", f"<!-- kb:{key}:end -->"
    block = f"{start}\n{body}\n{end}"
    if start not in text and end not in text:
        return text.rstrip() + "\n\n" + block + "\n"
    if text.count(start) != 1 or text.count(end) != 1 or text.index(start) >= text.index(end):
        raise ValueError(f"Malformed generated block: {key}")
    before, rest = text.split(start, 1)
    _, after = rest.split(end, 1)
    return before + block + after


def expected_pages(root: Path, memory: dict) -> dict[Path, str]:
    wiki = root / "wiki"
    pages = {p: p.read_text(encoding="utf-8") for p in wiki.glob("*.md")}
    for name, key, content in (
        ("sources.md", "catalog", render_catalog(root, memory)),
        ("outputs.md", "outputs", render_outputs(root, memory)),
    ):
        path = wiki / name
        if path not in pages:
            raise ValueError(f"Create the register header before refreshing: {path.name}")
        pages[path] = replace_block(pages[path], key, content)
    incoming: dict[Path, set[Path]] = {p: set() for p in pages}
    for page, text in pages.items():
        for href in markdown_hrefs(BACKLINKS.sub("", text)):
            target = local_link(page, href)
            if target in incoming and target != page:
                incoming[target].add(page)
    for page in pages:
        lines = ["## Backlinks", ""]
        lines += [
            f"- [{cell(title(other))}]({quote(other.name)})"
            for other in sorted(incoming[page])
        ] or ["No incoming wiki links."]
        pages[page] = replace_block(pages[page], "backlinks", "\n".join(lines))
    return pages


def inspect(root: Path, memory: dict, *, project_root: Path | None = None) -> dict:
    project_root = (project_root or root.parent).resolve()
    pages = expected_pages(root, memory)
    errors, origin_changes = [], []
    stale = []
    incoming = {p: set() for p in pages}
    for page, expected in pages.items():
        actual = page.read_text(encoding="utf-8")
        if actual != expected:
            stale.append(page.relative_to(root).as_posix())
        for href in markdown_hrefs(BACKLINKS.sub("", actual)):
            target = local_link(page, href)
            if target is None:
                continue
            if not target.exists():
                errors.append(f"Broken link: {page.name} -> {href}")
            if target in incoming and target != page:
                incoming[target].add(page)
    orphans = [p.name for p, refs in incoming.items() if p.name != "index.md" and not refs]
    errors += [f"Orphan page: {name}" for name in orphans]
    names = set(memory["sources"]) | {
        p.relative_to(root).as_posix() for p in (root / "raw").rglob("*") if p.is_file()
    }
    states = {name: source_state(root, name, memory["sources"].get(name, {}))
              for name in sorted(names)}
    archived_findings = []
    for name, state in states.items():
        if not (root / name).resolve().is_relative_to((root / "raw").resolve()):
            errors.append(f"Source outside raw directory: {name}")
        elif state == "processed" and not in_processed(root, name):
            errors.append(f"Processed source outside raw/processed: {name}")
        elif in_processed(root, name) and state in ("pending", "changed"):
            archived_findings.append({"source": name, "state": state,
                                      "note": "Requires compilation; refresh does not move or process sources."})
    for name, record in memory["sources"].items():
        original = record.get("origin_path")
        if original:
            origin = (project_root / original).resolve()
            if not origin.is_relative_to(project_root):
                errors.append(f"Origin outside project: {name}")
            elif not origin.is_file() or digest(origin) != record.get("origin_sha256"):
                origin_changes.append({"source": name, "origin": original,
                                       "historical": record.get("historical", False)})
        for page in record.get("wiki_pages", []):
            if not (root / page).is_file():
                errors.append(f"Missing source dependency: {name} -> {page}")
    outputs = memory.get("outputs", {})
    output_names = set(outputs) | {
        p.relative_to(root).as_posix() for p in (root / "outputs").rglob("*.md")
    }
    reviews = {name: output_state(root, name, outputs.get(name, {}))
               for name in sorted(output_names)}
    for name, record in outputs.items():
        status = reviews[name]
        if status == "filed" and not record.get("wiki_pages"):
            errors.append(f"Filed output has no wiki destination: {name}")
        for dependency in record.get("wiki_pages", []) + record.get("evidence", []):
            if not (root / dependency).is_file():
                errors.append(f"Missing output evidence/destination: {name} -> {dependency}")
    markdown_outputs = sorted((root / "outputs").rglob("*.md"))
    for page in markdown_outputs:
        for href in markdown_hrefs(page.read_text(encoding="utf-8")):
            target = local_link(page, href)
            if target is not None and not target.exists():
                errors.append(f"Broken link: {page.relative_to(root).as_posix()} -> {href}")
    return {"source_states": states, "output_states": reviews, "orphan_pages": orphans,
            "origin_changes": origin_changes, "stale_generated_pages": stale,
            "archived_source_findings": archived_findings,
            "errors": errors, "wiki_pages": len(pages),
            "checked_output_markdown_files": len(markdown_outputs)}


def refresh(root: Path, memory: dict) -> list[str]:
    # Refuse malformed blocks before writing any page. Raw and memory are never written.
    pages = expected_pages(root, memory)
    changed = []
    for path, expected in pages.items():
        if path.resolve().parent != (root / "wiki").resolve():
            raise ValueError("Generated page must remain in the wiki directory.")
        if path.read_text(encoding="utf-8") != expected:
            temp = path.with_name(path.name + ".tmp")
            if temp.exists():
                raise ValueError(f"Temporary page exists; reconcile first: {temp.name}")
            temp.write_text(expected, encoding="utf-8", newline="\n")
            temp.replace(path)
            changed.append(path.relative_to(root).as_posix())
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("check", "refresh"))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    memory = json.loads((root / "memory.json").read_text(encoding="utf-8"))
    if args.action == "refresh":
        refresh(root, memory)
    result = inspect(root, memory, project_root=root.parents[1])
    print(json.dumps(result, indent=2))
    return 1 if result["errors"] or result["stale_generated_pages"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
