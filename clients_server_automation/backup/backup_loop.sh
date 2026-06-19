#!/bin/bash
cd ~/app/clients
while true; do
  find */data */private -type f 2>/dev/null | entr -dn ~/app/entr_script.sh
  [ $? -eq 2 ] && ~/app/entr_script.sh
  sleep 1
done
