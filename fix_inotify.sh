#!/bin/bash
# Fix for EMFILE: too many open files when running Next.js dev server
# This increases the inotify max_user_instances limit permanently

echo "Current max_user_instances: $(cat /proc/sys/fs/inotify/max_user_instances)"

# Apply immediately
sudo sysctl fs.inotify.max_user_instances=512

# Make it permanent (survives reboot)
if ! grep -q "max_user_instances" /etc/sysctl.conf; then
  echo "fs.inotify.max_user_instances=512" | sudo tee -a /etc/sysctl.conf
  echo "Permanent fix written to /etc/sysctl.conf"
fi

echo "New max_user_instances: $(cat /proc/sys/fs/inotify/max_user_instances)"
echo ""
echo "Now run: cd frontend && npm run dev"
