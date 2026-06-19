cd ~/app/clients
for c in */; do
  c=${c%/}
  [ -d "$c/data" ]    && mkdir -p "$HOME/app/qabu_clients/$c/data" \
    && rsync -a --delete "$c/data/"    "$HOME/app/qabu_clients/$c/data/"
  [ -d "$c/private" ] && mkdir -p "$HOME/app/qabu_clients/$c/private" \
    && rsync -a --delete "$c/private/" "$HOME/app/qabu_clients/$c/private/"
done
cd ~/app/qabu_clients
git add -A
git diff --cached --quiet || {
   git commit -m "auto $(date -Iseconds)"
   git push || echo "push failed, will retry next change" >&2
}
echo "-------------------" >> ~/app/logs
