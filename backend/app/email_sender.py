"""Email sending via SMTP (aiosmtplib)."""
from __future__ import annotations

import asyncio
import email.message
from typing import Any

import aiosmtplib

from .config import config


async def send_email(to: str, subject: str, html: str, text: str | None = None) -> None:
    smtp = config.smtp
    if not smtp.get("host"):
        # No SMTP configured: log instead of failing hard (dev mode).
        print(f"[email:dev-mode] to={to} subject={subject}")
        return

    msg = email.message.EmailMessage()
    msg["From"] = (
        f"{smtp.get('from_name', 'Packages Notifier')} <{smtp.get('from_addr')}>"
        if smtp.get("from_name")
        else str(smtp.get("from_addr"))
    )
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text or "This email requires HTML view.")
    msg.add_alternative(html, subtype="html")

    kwargs: dict[str, Any] = dict(
        hostname=smtp["host"],
        port=int(smtp.get("port", 465)),
        use_tls=bool(smtp.get("use_tls", True)),
    )
    if smtp.get("username"):
        kwargs.update(username=smtp["username"], password=smtp.get("password", ""))

    async def _send():
        await aiosmtplib.send(msg, **kwargs)

    # retry once on transient failure
    try:
        await asyncio.wait_for(_send(), timeout=30)
    except Exception:
        await asyncio.sleep(2)
        await asyncio.wait_for(_send(), timeout=30)


def verification_email_html(code: str, purpose: str, package: str | None, ttl_minutes: int) -> tuple[str, str]:
    """Return (subject, html) for a verification code email."""
    purpose_text = {
        "subscribe": "订阅",
        "unsubscribe": "取消订阅",
        "add_package": "添加关注包",
    }.get(purpose, purpose)
    pkg_line = (
        f'<p style="margin:0 0 16px;color:#8a8c92;font-size:14px;">目标包：<code style="color:#fff;background:#212023;padding:2px 8px;border-radius:4px;">{package}</code></p>'
        if package
        else ""
    )
    subject = f"【Packages Notifier】验证码 {code}"
    html = f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#171719;font-family:-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#131217;border-radius:8px;padding:32px;border:1px solid #222224;">
      <p style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:600;">Packages Notifier</p>
      <p style="margin:0 0 24px;color:#8a8c92;font-size:14px;">{purpose_text}操作验证码</p>
      {pkg_line}
      <div style="background:#212023;border-radius:6px;padding:20px;text-align:center;margin-bottom:24px;">
        <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#4a8ad6;font-variant-numeric:tabular-nums;">{code}</span>
      </div>
      <p style="margin:0 0 8px;color:#8a8c92;font-size:13px;line-height:1.6;">验证码 {ttl_minutes} 分钟内有效。如果不是您本人的操作，请忽略此邮件。</p>
    </div>
    <p style="margin:16px 0 0;color:#55575c;font-size:12px;text-align:center;">Packages Notifier · npm package update alerts</p>
  </div>
</body></html>"""
    text = f"Packages Notifier 验证码：{code}（{ttl_minutes} 分钟内有效）"
    return subject, html
