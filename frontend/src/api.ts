const BASE = "";

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(BASE + path, {
      headers: { "content-type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, "network");
  }
  if (!resp.ok) {
    let detail = "error";
    try {
      const data = await resp.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail ?? data);
    } catch {
      /* ignore */
    }
    throw new ApiError(resp.status, detail);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),

  listPackages: () =>
    request<{ packages: { package: string; latest_version: string | null; added_at: number; package_type?: string }[] }>(
      "/api/packages"
    ),

  listEcosystems: () =>
    request<{ ecosystems: { type: string; label: string; interval_seconds: number }[] }>(
      "/api/ecosystems"
    ),

  packageDetail: (name: string) =>
    request<{
      package: {
        name: string;
        latest: string;
        description: string;
        versions_count: number;
        recent_versions: string[];
        modified: string;
        latest_published_at: string | null;
        homepage: string;
        author: string;
        license: string;
      };
      watched: boolean;
    }>(`/api/packages/${encodeURIComponent(name)}`),

  subscribeRequestCode: (
    email: string,
    pkg: string,
    versionMatch?: string,
    versionPattern?: string
  ) =>
    request<{ ok: boolean; latest: string; dev_code: string | null }>(
      "/api/subscribe/request-code",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          package: pkg,
          ...(versionMatch && versionMatch !== "any"
            ? { version_match: versionMatch, version_pattern: versionPattern }
            : {}),
        }),
      }
    ),

  subscribeVerify: (email: string, pkg: string, code: string) =>
    request<{ ok: boolean }>("/api/subscribe/verify", {
      method: "POST",
      body: JSON.stringify({ email, package: pkg, code }),
    }),

  unsubscribeRequestCode: (email: string, pkg: string) =>
    request<{ ok: boolean; dev_code: string | null }>("/api/unsubscribe/request-code", {
      method: "POST",
      body: JSON.stringify({ email, package: pkg }),
    }),

  unsubscribeVerify: (email: string, pkg: string, code: string) =>
    request<{ ok: boolean; deleted: boolean }>("/api/unsubscribe/verify", {
      method: "POST",
      body: JSON.stringify({ email, package: pkg, code }),
    }),

  mySubscriptions: (email: string) =>
    request<{
      email: string;
      subscriptions: {
        package: string;
        verified: boolean;
        created_at: number;
        last_notified_version: string | null;
        version_match: string;
        version_pattern: string | null;
      }[];
    }>(`/api/subscriptions?email=${encodeURIComponent(email)}`),

  pollerStatus: () =>
    request<{ running: boolean; last_run: number | null; interval_seconds: number }>(
      "/api/poller/status"
    ),

  adminGetConfig: (token: string) =>
    request<Record<string, any>>("/admin/config", {
      headers: { authorization: `Bearer ${token}` },
    }),

  adminSetConfig: (token: string, cfg: Record<string, any>) =>
    request<Record<string, any>>("/admin/config", {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(cfg),
    }),
};

export function apiErrMessage(err: unknown, t: (k: string) => string): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return t("err.network");
    if (err.status === 429) return t("err.tooMany");
    if (err.status === 404) return t("err.notFound");
    if (err.status === 400 && err.detail.toLowerCase().includes("code")) return t("err.badCode");
    if (err.status === 400 && err.detail.toLowerCase().includes("email")) return t("err.invalidEmail");
    if (err.status === 400 && err.detail.toLowerCase().includes("package")) return t("err.invalidPkg");
    return err.detail;
  }
  return String(err);
}
