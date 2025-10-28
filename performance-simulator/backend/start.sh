#!/bin/sh
echo "Starting Performance Simulator Backend..."
echo "Working directory: $(pwd)"
echo "Files in /app:"
ls -la /app/
echo "Binary details:"
ls -la /app/main 2>/dev/null || echo "main binary not found"
echo "Environment variables:"
env | grep DB_
echo "Attempting to run binary..."
exec /app/main "$@"
