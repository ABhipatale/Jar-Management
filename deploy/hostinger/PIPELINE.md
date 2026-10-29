# Pre-prod auto deploy (GitHub Actions)

Push to the `prepod` branch → about 3–4 minutes later https://preproduction-easyjar.abnexa.in is updated.
Pipeline file: `.github/workflows/deploy-preprod.yml`.

What it does: builds React + Laravel (same as `build.sh`), copies only changed files over SSH
into the pre-prod folders, then clears Laravel's cache.

What it never does:
- touch the live site (`public_html/easyjar`, `laravel/`) — paths must contain "preproduction" or it stops
- run migrations or change the database — run the SQL files yourself in phpMyAdmin
- upload or delete the server's `.env`, `storage/` or `bootstrap/cache/`

## One-time setup

### 1. SSH details (hPanel)
hPanel → Advanced → **SSH Access** → enable it and note **IP/host**, **port** (usually 65002) and **username** (u848097686).

### 2. Make a deploy key (on your PC, Git Bash)
```bash
ssh-keygen -t ed25519 -f ~/.ssh/easyjar_preprod -N "" -C "github-preprod-deploy"
cat ~/.ssh/easyjar_preprod.pub    # copy this line
```
hPanel → SSH Access → **SSH keys** → Add SSH key → paste the `.pub` line.

Test it:
```bash
ssh -i ~/.ssh/easyjar_preprod -p 65002 u848097686@YOUR_HOST "ls domains/abnexa.in"
```
You should see `public_html` and `preproduction-easyjar-laravel`. If the folders are somewhere else,
tell Claude/change `WEB_DIR` and `APP_DIR` at the top of the pipeline file.

### 3. GitHub secrets
GitHub → repo **Jar-Management** → Settings → Secrets and variables → Actions → **New repository secret**:

| Name       | Value                                                          |
|------------|----------------------------------------------------------------|
| `SSH_HOST` | host/IP from hPanel                                            |
| `SSH_PORT` | port from hPanel (e.g. 65002)                                  |
| `SSH_USER` | username from hPanel (e.g. u848097686)                         |
| `SSH_KEY`  | whole content of `~/.ssh/easyjar_preprod` (the file **without** `.pub`) |

### 4. Create the branch (once)
```bash
git checkout -b prepod
git push jarmanagemet prepod
```
GitHub → **Actions** tab → "Deploy pre-production" → watch it go green.

## Daily use
```bash
git checkout prepod
git merge main
git push jarmanagemet prepod
git checkout main
```
New database column/table? Run its SQL file on the **pre-prod** database in phpMyAdmin first,
then push — otherwise pre-prod shows errors until the SQL is run.

Live is still manual: `bash deploy/hostinger/build.sh easyjar.abnexa.in` → upload zips.
