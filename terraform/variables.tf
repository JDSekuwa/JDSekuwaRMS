variable "cloudflare_api_token" {
  description = "Cloudflare API Token with DNS edit permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for jdsekuwahouse.com.np"
  type        = string
}

variable "domain_name" {
  description = "Target root domain name"
  type        = string
  default     = "jdsekuwahouse.com.np"
}

variable "server_ip" {
  description = "Public IP address of the target server hosting the application"
  type        = string
  default     = "76.76.21.21" # Default Vercel Anycast IP or replace with your VPS IP
}

variable "enable_proxy" {
  description = "Whether Cloudflare proxy (orange cloud) is enabled"
  type        = bool
  default     = false
}
