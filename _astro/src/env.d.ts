type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    // Cloudflare Access の JWT 検証を middleware で済ませた後、page /
    // endpoint からは Astro.locals.user で利用できる。/admin 配下は
    // middleware で必ずセットされる前提。それ以外のパスでは undefined。
    user?: {
      email: string;
      bypassed: boolean;
    };
  }
}
