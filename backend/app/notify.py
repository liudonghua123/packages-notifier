"""Notification dispatch: on update, email all verified subscribers."""
from __future__ import annotations

from . import db
from .email_sender import send_email


def update_email_html(pkg: str, old: str, new: str, meta: dict) -> tuple[str, str]:
    subject = f"📦 {pkg} 已更新 {old} → {new}"
    desc = meta.get("description") or ""
    html = f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#171719;font-family:-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#131217;border-radius:8px;padding:32px;border:1px solid #222224;">
      <p style="margin:0 0 4px;color:#8a8c92;font-size:13px;">npm package update</p>
      <p style="margin:0 0 16px;color:#fff;font-size:22px;font-weight:700;font-family:'JetBrains Mono',Consolas,monospace;">{pkg}</p>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <span style="color:#8a8c92;font-family:monospace;font-size:16px;text-decoration:line-through;">{old}</span>
        <span style="color:#4a8ad6;">→</span>
        <span style="color:#44a282;font-family:monospace;font-size:18px;font-weight:700;">{new}</span>
      </div>
      {f'<p style="margin:0 0 24px;color:#bdbdc0;font-size:14px;line-height:1.6;">{desc}</p>' if desc else ''}
      <a href="https://www.npmjs.com/package/{pkg}" style="display:inline-block;background:#4a8ad6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px;font-size:14px;font-weight:600;">在 npmjs.com 查看</a>
    </div>
    <p style="margin:16px 0 0;color:#55575c;font-size:12px;text-align:center;">Packages Notifier · 您订阅了此包的更新通知</p>
  </div>
</body></html>"""
    text = f"{pkg} 已更新：{old} -> {new}  https://www.npmjs.com/package/{pkg}"
    return subject, html


async def notify_update(pkg: str, old: str, new: str, meta: dict) -> None:
    subscribers = await db.run(db.verified_subscribers, pkg)
    subject, html = update_email_html(pkg, old, new, meta)
    for email in subscribers:
        ok, err = True, None
        try:
            await send_email(email, subject, html)
        except Exception as exc:
            ok, err = False, repr(exc)
        await db.run(db.record_notification, email, pkg, new, ok, err)
        if ok:
            await db.run(db.set_last_notified, email, pkg, new)
