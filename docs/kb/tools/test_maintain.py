"""Checks for derived navigation and source/output state recovery.

Run from the project root: python -B docs/kb/tools/test_maintain.py
"""
import hashlib
import json
from pathlib import Path
import tempfile
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))   # maintain.py is in the same folder
import maintain


class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="kb-maintain-test-")
        self.root = Path(self.temp.name).resolve()
        assert self.root.is_relative_to(Path(tempfile.gettempdir()).resolve())
        assert self.root.name.startswith("kb-maintain-test-")
        for name in ("wiki", "raw", "outputs"):
            (self.root / name).mkdir()
        (self.root / "raw/processed").mkdir()
        for name, text in {
            "index.md": "# Index\n\n[A](a.md) [B](b.md) [Sources](sources.md) [Outputs](outputs.md)\n",
            "a.md": "# A\n\nHuman note must survive. [B](b.md)\n",
            "b.md": "# B\n\nNo authored link to A.\n",
            "sources.md": "# Source catalog\n",
            "outputs.md": "# Output register\n",
        }.items():
            (self.root / "wiki" / name).write_text(text, encoding="utf-8")
        (self.root / "raw/processed/source.md").write_text("# Original source\n", encoding="utf-8")
        (self.root / "outputs/report.md").write_text("# Saved answer\n", encoding="utf-8")
        self.memory = {
            "sources": {"raw/processed/source.md": {"processed_sha256": maintain.digest(self.root / "raw/processed/source.md"),
                "summary": "Source summary.", "wiki_pages": ["wiki/a.md"]}},
            "outputs": {"outputs/report.md": {"reviewed_sha256": maintain.digest(self.root / "outputs/report.md"),
                "status": "filed", "contribution": "Supported finding.", "wiki_pages": ["wiki/a.md"],
                "evidence": ["raw/processed/source.md"]}},
        }

    def tearDown(self):
        # Validate the temporary cleanup boundary before recursive library cleanup.
        assert self.root.is_relative_to(Path(tempfile.gettempdir()).resolve())
        assert self.root.name.startswith("kb-maintain-test-")
        self.temp.cleanup()

    def hashes(self):
        return {p.relative_to(self.root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in self.root.rglob("*") if p.is_file()}

    def test_new_changed_and_missing_sources_are_not_marked_processed(self):
        (self.root / "raw/new.md").write_text("New source", encoding="utf-8")
        before = json.dumps(self.memory, sort_keys=True)
        result = maintain.inspect(self.root, self.memory)
        self.assertEqual("pending", result["source_states"]["raw/new.md"])
        (self.root / "raw/processed/source.md").write_text("Edited source", encoding="utf-8")
        self.assertEqual("changed", maintain.source_state(self.root, "raw/processed/source.md", self.memory["sources"]["raw/processed/source.md"]))
        self.assertEqual("missing", maintain.source_state(self.root, "raw/missing.md", {}))
        self.assertEqual(before, json.dumps(self.memory, sort_keys=True))

    def test_refresh_preserves_human_text_sources_reports_and_memory(self):
        before = self.hashes()
        memory = json.dumps(self.memory, sort_keys=True)
        maintain.refresh(self.root, self.memory)
        self.assertIn("Human note must survive.", (self.root / "wiki/a.md").read_text(encoding="utf-8"))
        after = self.hashes()
        for name in ("raw/processed/source.md", "outputs/report.md"):
            self.assertEqual(before[name], after[name])
        self.assertEqual(memory, json.dumps(self.memory, sort_keys=True))

    def test_backlinks_do_not_generate_feedback_and_refresh_is_idempotent(self):
        maintain.refresh(self.root, self.memory)
        before = self.hashes()
        self.assertEqual([], maintain.refresh(self.root, self.memory))
        self.assertEqual(before, self.hashes())
        a = (self.root / "wiki/a.md").read_text(encoding="utf-8").split("<!-- kb:backlinks:start -->")[1]
        b = (self.root / "wiki/b.md").read_text(encoding="utf-8").split("<!-- kb:backlinks:start -->")[1]
        self.assertNotIn("(b.md)", a)
        self.assertIn("(a.md)", b)
        result = maintain.inspect(self.root, self.memory)
        self.assertEqual([], result["errors"])
        self.assertEqual([], result["stale_generated_pages"])

    def test_edited_output_requires_review_again(self):
        self.assertEqual("filed", maintain.output_state(self.root, "outputs/report.md", self.memory["outputs"]["outputs/report.md"]))
        (self.root / "outputs/report.md").write_text("Changed answer", encoding="utf-8")
        self.assertEqual("needs review", maintain.output_state(self.root, "outputs/report.md", self.memory["outputs"]["outputs/report.md"]))

    def test_filed_output_requires_destination_and_evidence_must_exist(self):
        self.memory["outputs"]["outputs/report.md"]["wiki_pages"] = []
        self.memory["outputs"]["outputs/report.md"]["evidence"] = ["raw/absent.md"]
        errors = maintain.inspect(self.root, self.memory)["errors"]
        self.assertTrue(any("no wiki destination" in e for e in errors))
        self.assertTrue(any("Missing output evidence" in e for e in errors))

    def test_malformed_generated_block_prevents_any_page_write(self):
        (self.root / "wiki/b.md").write_text("# B\n<!-- kb:backlinks:start -->\n", encoding="utf-8")
        before = self.hashes()
        with self.assertRaises(ValueError):
            maintain.refresh(self.root, self.memory)
        self.assertEqual(before, self.hashes())

    def test_check_is_read_only(self):
        before = self.hashes()
        maintain.inspect(self.root, self.memory)
        self.assertEqual(before, self.hashes())

    def test_processed_sources_must_be_in_processed_directory(self):
        previous = "raw/processed/source.md"
        current = "raw/source.md"
        (self.root / previous).replace(self.root / current)
        self.memory["sources"][current] = self.memory["sources"].pop(previous)
        self.memory["outputs"]["outputs/report.md"]["evidence"] = [current]
        result = maintain.inspect(self.root, self.memory)
        self.assertIn(f"Processed source outside raw/processed: {current}", result["errors"])
        self.assertEqual("processed", result["source_states"][current])

    def test_archived_changes_and_untracked_archived_files_stay_pending(self):
        changed = "raw/processed/source.md"
        new = "raw/processed/new.md"
        (self.root / changed).write_text("New source version\n", encoding="utf-8")
        (self.root / new).write_text("New uncompiled input\n", encoding="utf-8")
        before = self.hashes()
        memory = json.dumps(self.memory, sort_keys=True)
        maintain.refresh(self.root, self.memory)
        result = maintain.inspect(self.root, self.memory)
        findings = {finding["source"]: finding["state"]
                    for finding in result["archived_source_findings"]}
        self.assertEqual({changed: "changed", new: "pending"}, findings)
        self.assertEqual([], result["errors"])
        self.assertEqual(memory, json.dumps(self.memory, sort_keys=True))
        self.assertEqual(before[changed], maintain.digest(self.root / changed))
        self.assertEqual(before[new], maintain.digest(self.root / new))
        self.assertFalse((self.root / "raw/source.md").exists())
        self.assertFalse((self.root / "raw/new.md").exists())

    def test_safe_relocation_keeps_version_and_requires_current_evidence_path(self):
        archived = "raw/processed/source.md"
        incoming = "raw/source.md"
        record = self.memory["sources"].pop(archived)
        expected_hash = record["processed_sha256"]
        (self.root / archived).replace(self.root / incoming)
        self.memory["sources"][incoming] = record
        (self.root / incoming).replace(self.root / archived)
        moved = self.memory["sources"].pop(incoming)
        moved["relocated_from"] = incoming
        self.memory["sources"][archived] = moved
        self.memory["outputs"]["outputs/report.md"]["evidence"] = [archived]
        (self.root / "outputs/report.md").write_text(
            "# Saved answer\n\n[Source](../raw/processed/source.md)\n", encoding="utf-8")
        maintain.refresh(self.root, self.memory)
        result = maintain.inspect(self.root, self.memory)
        self.assertEqual("processed", result["source_states"][archived])
        self.assertEqual(expected_hash, maintain.digest(self.root / archived))
        self.assertEqual([], result["errors"])
        self.memory["outputs"]["outputs/report.md"]["evidence"] = [incoming]
        self.assertTrue(any("Missing output evidence" in error
                            for error in maintain.inspect(self.root, self.memory)["errors"]))

    def test_recursive_catalog_uses_unambiguous_relative_source_names(self):
        (self.root / "raw/source.md").write_text("Pending newer version\n", encoding="utf-8")
        catalog = maintain.render_catalog(self.root, self.memory)
        self.assertIn("[raw/source.md](../raw/source.md)", catalog)
        self.assertIn("[raw/processed/source.md](../raw/processed/source.md)", catalog)
        self.assertNotIn("[source.md]", catalog)

    def test_output_links_are_checked_but_code_comments_and_commands_are_not(self):
        (self.root / "outputs/report.md").write_text(
            "# Saved answer\n\n[Good](../raw/processed/source.md)\n"
            "[Missing](missing-real.md)\n"
            "`[Inline example](missing-inline.md)`\n"
            "```md\n[Fenced example](missing-fenced.md)\n```\n"
            "~~~md\n[Tilde example](missing-tilde.md)\n~~~\n"
            "<!-- [Comment example](missing-comment.md) -->\n"
            "python missing-command.py\n"
            "[Web](https://example.com/article) [Section](#heading)\n", encoding="utf-8")
        result = maintain.inspect(self.root, self.memory)
        errors = [error for error in result["errors"] if "Broken link" in error]
        self.assertEqual(["Broken link: outputs/report.md -> missing-real.md"], errors)
        self.assertEqual(1, result["checked_output_markdown_files"])

    def test_reference_and_spaced_markdown_destinations_are_checked(self):
        (self.root / "raw/processed/source (copy).md").write_text("Copy\n", encoding="utf-8")
        (self.root / "outputs/report.md").write_text(
            '# Saved answer\n\n[Copy](<../raw/processed/source (copy).md> "Local copy")\n'
            "[Reference][known] [Absent reference][missing]\n"
            "[known]: ../raw/processed/source.md\n"
            "[missing]: missing-reference.md\n", encoding="utf-8")
        errors = maintain.inspect(self.root, self.memory)["errors"]
        self.assertEqual(["Broken link: outputs/report.md -> missing-reference.md"], errors)

    def test_archived_source_origins_resolve_against_project_not_archive(self):
        original = self.root / "original-project-document.md"
        original.write_text("Original project document\n", encoding="utf-8")
        record = self.memory["sources"]["raw/processed/source.md"]
        record["origin_path"] = "original-project-document.md"
        record["origin_sha256"] = maintain.digest(original)
        self.assertEqual([], maintain.inspect(
            self.root, self.memory, project_root=self.root
        )["origin_changes"])
        original.write_text("Changed project document\n", encoding="utf-8")
        changes = maintain.inspect(self.root, self.memory, project_root=self.root)["origin_changes"]
        self.assertEqual("raw/processed/source.md", changes[0]["source"])

    def test_sources_outside_raw_are_reported_without_mutation(self):
        self.memory["sources"]["outputs/report.md"] = {}
        before = self.hashes()
        self.assertIn("Source outside raw directory: outputs/report.md",
                      maintain.inspect(self.root, self.memory)["errors"])
        self.assertEqual(before, self.hashes())


if __name__ == "__main__":
    unittest.main()
