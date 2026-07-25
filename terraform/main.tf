# Root domain A Record (@ -> server_ip)
resource "cloudflare_record" "root_a" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  value   = var.server_ip
  type    = "A"
  proxied = var.enable_proxy
  comment = "Managed by Terraform - JD Sekuwa RMS Root A Record"
}

# Subdomain CNAME Record (www -> root or vercel)
resource "cloudflare_record" "www_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  value   = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = var.enable_proxy
  comment = "Managed by Terraform - JD Sekuwa RMS www CNAME Record"
}
