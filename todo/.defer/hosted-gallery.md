# Hosted gallery (split from v0.4.0-loose-ends.md, decided and deferred)

Decision (2026-07-17): the hosting target is a subdomain of the owner's own domain (option: "a subdomain of your domain"), executed later. The exact subdomain name and the hosting behind it remain the owner's call at execution time. GitHub Pages / Cloudflare Pages were considered and passed over; unhosted remains the state until this is picked up.

### Hosted gallery

The gallery is the primary documentation but is only accessible via git clone + local serve. Host it publicly so consumers can see the framework without cloning. Deferred during the session because creating external resources (GitHub Pages, domain, etc.) needs explicit name/service approval per CLAUDE.md.

Decision needed: hosting target (GitHub Pages on the repo, a subdomain, Cloudflare Pages, etc.).

Effort: trivial once the target is approved
