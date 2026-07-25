output "root_domain_hostname" {
  description = "Fully qualified domain name for root"
  value       = cloudflare_record.root_a.hostname
}

output "www_subdomain_hostname" {
  description = "Fully qualified domain name for www subdomain"
  value       = cloudflare_record.www_cname.hostname
}

output "root_record_id" {
  description = "Cloudflare record ID for root A record"
  value       = cloudflare_record.root_a.id
}
