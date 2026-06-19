# Client-data backup

Continuously mirrors every client's `data/` and `private/` from the client VM
into a dedicated git repo (`git@gitlab.com:rny3/qabu_clients.git`) and pushes on
every change. This is the fix for the #1 known gap in `CLAUDE.md` (no backups for
client data — the VM volume is authoritative *and* unprotected).

These files live on the client VM under `~/app/` (the scripts) and
`~/.config/systemd/user/` (the unit). The copies here are the source of truth for
the mechanism itself — keep them in sync if you edit them on the VM.

## How it works

- **`backup_loop.sh`** — watches `~/app/clients/*/{data,private}` with `entr` and
  runs `entr_script.sh` on any change. Re-globs every iteration, so **new clients
  are picked up automatically** on the next cycle. Note the `-n` flag on `entr`:
  it runs non-interactively, required because there is no TTY under systemd.
- **`entr_script.sh`** — `rsync`s every client's `data/` and `private/` into
  `~/app/qabu_clients/<client>/`, then `git add -A` + commit + push. Skips the
  commit when nothing changed.
- **`qabu_clients.gitignore`** — the `.gitignore` for the *backup* repo
  (`~/app/qabu_clients/.gitignore`). A whitelist that ignores everything but
  un-ignores `*/data/**` and `*/private/**`. Without the `**` rules, only
  already-tracked files get committed and new clients are silently dropped.
- **`qabu-backup.service`** — user systemd unit (`Restart=always`) that runs the
  loop. Installed under `~/.config/systemd/user/`, needs lingering enabled so it
  survives logout/reboot.

## Install on a client VM

```sh
# scripts
cp backup_loop.sh entr_script.sh ~/app/
chmod +x ~/app/backup_loop.sh ~/app/entr_script.sh

# backup repo (one-time): clone it, drop in the whitelist
git clone git@gitlab.com:rny3/qabu_clients.git ~/app/qabu_clients
cp qabu_clients.gitignore ~/app/qabu_clients/.gitignore

# service (no sudo needed — user service + lingering)
mkdir -p ~/.config/systemd/user
cp qabu-backup.service ~/.config/systemd/user/
loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now qabu-backup.service
```

## Check / debug

```sh
systemctl --user status qabu-backup
journalctl --user -u qabu-backup -f
git -C ~/app/qabu_clients log --oneline -5
```

## History / gotchas

The original version was hardcoded to `eintal` (both the watch and the rsync), so
only eintal ever got backed up. Two more bugs surfaced when generalizing it:
1. `rsync -a` won't create the destination parent — needs `mkdir -p` first.
2. The backup repo's whitelist `.gitignore` only un-ignored directories, not
   files, so never-before-tracked clients were silently ignored.
3. `entr` aborts without a TTY; under systemd it needs `-n`.
