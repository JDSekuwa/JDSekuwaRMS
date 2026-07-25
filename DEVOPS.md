# Senior DevOps & Infrastructure Blueprint: JD Sekuwa RMS

This repository includes a production-ready DevOps infrastructure setup for long-term scalability, automated deployment, and Infrastructure as Code (IaC).

---

## 🏗️ Architecture Overview

```
                        +----------------------------+
                        |  register.com.np (Hostmaster)|
                        |  Nameservers: Cloudflare   |
                        +--------------+-------------+
                                       |
                                       v
                        +----------------------------+
                        |     Cloudflare DNS         |
                        |   (jdsekuwahouse.com.np)   |
                        +--------------+-------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
                   v                                       v
     [Option A: Managed Hosting]             [Option B: Self-Hosted VPS]
     Vercel Serverless Edge                  Ubuntu Server + Docker Engine
     IP: 76.76.21.21                         Configured via Ansible
```

---

## 🐳 1. Docker & Containerization

### Next.js Standalone Optimization
`next.config.ts` is configured with `output: 'standalone'` to create an ultra-lightweight Docker image (~120MB instead of ~1.2GB).

### Building & Running locally with Docker

```bash
# Build the Docker image
docker build -t jd-sekuwa-rms:latest .

# Run container standalone on port 3000
docker run -d --name jdsekuwa_app -p 3000:3000 --env-file .env jd-sekuwa-rms:latest
```

### Running with Docker Compose

```bash
# Start container stack in background
docker compose up -d --build

# View logs in real-time
docker compose logs -f app

# Stop containers
docker compose down
```

---

## 🛠️ 2. Automated Provisioning with Ansible

Ansible automates setting up a fresh Linux VPS (Ubuntu/Debian) from scratch:
- Installs Docker & Docker Compose plugin
- Configures UFW firewall (opens ports 22, 80, 443, 3000)
- Configures security and permissions
- Deploys and starts the application stack

### Running Ansible Playbook

```bash
cd ansible

# 1. Update inventory.ini with your VPS IP & SSH details
nano inventory.ini

# 2. Run the Ansible playbook
ansible-playbook -i inventory.ini playbook.yml
```

---

## 🌍 3. Infrastructure as Code (IaC) with Terraform

Terraform manages DNS records and domain infrastructure on Cloudflare automatically.

### Applying Terraform Infrastructure

```bash
cd terraform

# 1. Create your tfvars configuration file
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars

# 2. Initialize Terraform providers
terraform init

# 3. Preview planned changes
terraform plan

# 4. Apply changes
terraform apply
```

---

## 🔒 4. Production Security & Health Check Best Practices

1. **Health Check Endpoint**: `/api/health` returns status code `200 OK` for Docker engine, Cloudflare health checks, or AWS load balancers.
2. **Non-Root Execution**: Docker container runs under UID `1001` (`nextjs`), preventing privilege escalation vulnerabilities.
3. **Environment Security**: Never commit `.env` or `terraform.tfvars` containing secrets to Git. Always pass secrets via CI/CD secrets (e.g. GitHub Actions Secrets or Vault).
