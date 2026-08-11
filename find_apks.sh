: "${SSHPASS:?Set SSHPASS in the environment}"
sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 << 'EOF'
find / -name "*loteria-tv*.apk" 2>/dev/null
EOF
