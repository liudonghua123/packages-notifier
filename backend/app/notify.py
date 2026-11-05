"""Notification dispatch: on update, email matching verified subscribers."""
from __future__ import annotations

import re

from . import db
from .email_sender import send_email


def _version_matches(rule: dict, new_version: str) -> bool:
    """Check a subscriber's version match rule against the new version.

    Rules: any (default) | equals | startswith | regexmatch
    Patterns are matched against the full version string, case-insensitively.
    """
    mode = (rule.get("version_match") or "any").lower()
    if mode == "any":
        return True
    pattern = rule.get("version_pattern")
    if not pattern:
        return True
    if mode == "equals":
        return new_version.strip().lower() == pattern.strip().lower()
    if mode == "startswith":
        return new_version.strip().lower().startswith(pattern.strip().lower())
    if mode == "regexmatch":
        try:
            return re.search(pattern, new_version, re.IGNORECASE) is not None
        except re.error:
            return False
    return True


def _already_notified(rule: dict, new_version: str) -> bool:
    """True if this subscriber was already told about this exact version.

    Guards against duplicate emails when the poller re-detects the
    same update (e.g. after a crash between detection and version
    write-back).
    """
    return (rule.get("last_notified_version") or "") == new_version


def update_email_html(pkg: str, old: str, new: str, meta: dict) -> tuple[str, str]:
    ptype = (meta.get("package_type") or "npm").lower()
    # registry-specific package links
    links = {
        "npm": f"https://www.npmjs.com/package/{pkg}",
        "pypi": f"https://pypi.org/project/{pkg}/",
        "crates": f"https://crates.io/crates/{pkg}",
        "go": f"https://pkg.go.dev/{pkg}",
        "rubygems": f"https://rubygems.org/gems/{pkg}",
        "maven": f"https://central.sonatype.com/artifact/{pkg}",
        "nuget": f"https://www.nuget.org/packages/{pkg}/",
    }
    labels = {
        "npm": "npm",
        "pypi": "PyPI",
        "crates": "crates.io",
        "go": "Go modules",
        "rubygems": "RubyGems",
        "maven": "Maven Central",
        "nuget": "NuGet",
    }
    pkg_url = links.get(ptype, links["npm"])
    eco_label = labels.get(ptype, ptype)
    subject = f"[{eco_label}] {pkg} 已更新 {old} → {new}"
    desc = meta.get("description") or ""
    html = f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#171719;font-family:-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#131217;border-radius:8px;padding:32px;border:1px solid #222224;">
      <p style="margin:0 0 4px;color:#8a8c92;font-size:13px;">{eco_label} package update</p>
      <p style="margin:0 0 16px;color:#fff;font-size:22px;font-weight:700;font-family:'JetBrains Mono',Consolas,monospace;">{pkg}</p>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <span style="color:#8a8c92;font-family:monospace;font-size:16px;text-decoration:line-through;">{old}</span>
        <span style="color:#4a8ad6;">→</span>
        <span style="color:#44a282;font-family:monospace;font-size:18px;font-weight:700;">{new}</span>
      </div>
      {f'<p style="margin:0 0 24px;color:#bdbdc0;font-size:14px;line-height:1.6;">{desc}</p>' if desc else ''}
      <a href="{pkg_url}" style="display:inline-block;background:#4a8ad6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px;font-size:14px;font-weight:600;">在 {eco_label} 查看</a>
    </div>
    <p style="margin:16px 0 0;color:#55575c;font-size:12px;text-align:center;">Packages Notifier · 您订阅了此包的更新通知</p>
  </div>
</body></html>"""
    text = f"[{eco_label}] {pkg} 已更新：{old} -> {new}  {pkg_url}"
    return subject, html


async def notify_update(pkg: str, old: str, new: str, meta: dict) -> None:
    subscribers = await db.run(db.verified_subscribers, pkg)
    subject, html = update_email_html(pkg, old, new, meta)
    for rule in subscribers:
        if not _version_matches(rule, new):
            continue
        # skip duplicates: this subscriber already got an email for
        # this exact version
        if _already_notified(rule, new):
            continue
        email = rule["email"]
        ok, err = True, None
        try:
            await send_email(email, subject, html)
        except Exception as exc:
            ok, err = False, repr(exc)
        await db.run(db.record_notification, email, pkg, new, ok, err)
        if ok:
            await db.run(db.set_last_notified, email, pkg, new)
